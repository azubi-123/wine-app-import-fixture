import type { Express, Request, Response } from "express";
import { storage, generateSommelierTips } from "../storage";
import { openai } from "../lib/openai";
import { requireAuth } from "./auth";
import { db } from "../db";
import { users, tastings, responses, slides } from "@shared/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

// Helper: check AI response cache, return cached data or compute fresh
async function withAiCache<T>(
  email: string,
  cacheKey: string,
  compute: () => Promise<T>
): Promise<T> {
  try {
    const fingerprint = await storage.getTastingFingerprint(email);
    const cached = await storage.getAiResponseCache(email, cacheKey);

    if (cached && cached.fingerprint === fingerprint) {
      console.log(`[AI Cache] HIT for ${cacheKey} (${email})`);
      return cached.responseData as T;
    }

    console.log(`[AI Cache] MISS for ${cacheKey} (${email}) — computing fresh`);
    const result = await compute();

    // Store in cache (fire-and-forget)
    storage.setAiResponseCache(email, cacheKey, fingerprint, result).catch(err =>
      console.error(`[AI Cache] Failed to write cache for ${cacheKey}:`, err)
    );

    return result;
  } catch (cacheError) {
    // If cache logic fails, fall through to live computation
    console.error(`[AI Cache] Error for ${cacheKey}, falling through:`, cacheError);
    return compute();
  }
}


export function registerDashboardRoutes(app: Express) {
  console.log("👤 Registering user dashboard endpoints...");
  
  // Find participant by email across all sessions
  app.get("/api/participants/find-by-email", async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      // Find all participants with this email across all sessions
      const participants = await storage.getAllParticipantsByEmail(email);
      
      if (participants.length === 0) {
        return res.status(404).json({ message: "No participant found with this email" });
      }

      res.json({ participants });
    } catch (error) {
      console.error("Error finding participant by email:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user dashboard data
  app.get("/api/dashboard/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const { login } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      // Get all participants with this email
      const participants = await storage.getAllParticipantsByEmail(email);
      
      if (participants.length === 0) {
        return res.status(404).json({ message: "No participant found with this email" });
      }

      if (login !== undefined) {
        return res.json({ exists: true, email });
      }

      // Get dashboard data for all sessions
      const dashboardData = await storage.getUserDashboardData(email);
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's wine scores and ratings
  app.get("/api/dashboard/:email/scores", async (req, res) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const scores = await storage.getUserWineScores(email);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching user scores:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's tasting history
  app.get("/api/dashboard/:email/history", async (req, res) => {
    try {
      const { email } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const history = await storage.getUserTastingHistory(email, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching user history:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dashboard/:email/taste-profile", async (req, res) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      // Get user for level-aware insights
      const user = await storage.getUserByEmail(email);
      const userLevel = user?.tastingLevel || 'intro';

      // Call the new optimized method to get all data at once
      const profileData = await storage.getUserTasteProfileData(email);

      if (!profileData) {
        return res.status(404).json({ message: "No data found for this email" });
      }

      const { scores, dashboardData } = profileData;
      const totalWines = scores?.length || 0;

      // Generate taste profile analysis with cache
      const tasteProfile = await withAiCache(email, "wine_profiles", () =>
        generateTasteProfileAnalysis(scores, dashboardData, userLevel, totalWines)
      );

      res.json(tasteProfile);
    } catch (error) {
      console.error("Error generating taste profile:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get unified preferences (combined from solo + group tastings)
  app.get("/api/dashboard/:email/preferences", async (req, res) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      // Get preferences from solo tastings
      const user = await storage.getUserByEmail(email);
      let soloPrefs: { sweetness: number | null; acidity: number | null; tannins: number | null; body: number | null; count: number } = {
        sweetness: null, acidity: null, tannins: null, body: null, count: 0
      };

      if (user) {
        soloPrefs = await storage.getSoloTastingPreferences(user.id);
      }

      // Get preferences from group tastings
      const groupPrefs = await storage.getGroupTastingPreferences(email);

      // Combine both sources with weighted average
      const totalCount = soloPrefs.count + groupPrefs.count;

      if (totalCount === 0) {
        return res.json({
          sweetness: null,
          acidity: null,
          tannins: null,
          body: null,
          totalTastings: 0,
          soloTastings: 0,
          groupTastings: 0
        });
      }

      // Weighted average of preferences
      const combine = (solo: number | null, soloCount: number, group: number | null, groupCount: number) => {
        const validSolo = solo !== null ? { value: solo, count: soloCount } : null;
        const validGroup = group !== null ? { value: group, count: groupCount } : null;

        if (!validSolo && !validGroup) return null;
        if (!validSolo) return validGroup!.value;
        if (!validGroup) return validSolo.value;

        const totalWeight = validSolo.count + validGroup.count;
        return (validSolo.value * validSolo.count + validGroup.value * validGroup.count) / totalWeight;
      };

      res.json({
        sweetness: combine(soloPrefs.sweetness, soloPrefs.count, groupPrefs.sweetness, groupPrefs.count),
        acidity: combine(soloPrefs.acidity, soloPrefs.count, groupPrefs.acidity, groupPrefs.count),
        tannins: combine(soloPrefs.tannins, soloPrefs.count, groupPrefs.tannins, groupPrefs.count),
        body: combine(soloPrefs.body, soloPrefs.count, groupPrefs.body, groupPrefs.count),
        totalTastings: totalCount,
        soloTastings: soloPrefs.count,
        groupTastings: groupPrefs.count
      });
    } catch (error) {
      console.error("Error fetching unified preferences:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's sommelier feedback
  app.get("/api/dashboard/:email/sommelier-feedback", async (req, res) => {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const feedback = await storage.getUserSommelierFeedback(email);
      
      if (!feedback) {
        return res.status(404).json({ message: "No sommelier feedback found for this user" });
      }

      res.json(feedback);
    } catch (error) {
      console.error("Error fetching sommelier feedback:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get wine collection with detailed filtering
  app.get("/api/dashboard/:email/collection", async (req, res) => {
    try {
      const { email } = req.params;
      const { 
        search, 
        vintage, 
        region, 
        grapeVariety, 
        minRating, 
        wineType,
        sortBy = 'rating',
        sortOrder = 'desc'
      } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const scores = await storage.getUserWineScores(email);
      
      // Apply filters
      let filteredWines = scores.scores;
      
      if (search) {
        filteredWines = filteredWines.filter((wine: any) => 
          wine.wineName.toLowerCase().includes((search as string).toLowerCase()) ||
          wine.producer?.toLowerCase().includes((search as string).toLowerCase())
        );
      }
      
      if (vintage && vintage !== 'all') {
        filteredWines = filteredWines.filter((wine: any) => wine.vintage === parseInt(vintage as string));
      }
      
      if (region && region !== 'all') {
        filteredWines = filteredWines.filter((wine: any) => wine.region === region);
      }
      
      if (grapeVariety && grapeVariety !== 'all') {
        filteredWines = filteredWines.filter((wine: any) => 
          wine.grapeVarietals?.includes(grapeVariety)
        );
      }
      
      if (minRating) {
        filteredWines = filteredWines.filter((wine: any) => wine.averageScore >= parseFloat(minRating as string));
      }
      
      if (wineType && wineType !== 'all') {
        filteredWines = filteredWines.filter((wine: any) => wine.wineType === wineType);
      }
      
      // Apply sorting
      filteredWines.sort((a: any, b: any) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'rating':
            aValue = a.averageScore;
            bValue = b.averageScore;
            break;
          case 'name':
            aValue = a.wineName;
            bValue = b.wineName;
            break;
          case 'price':
            aValue = a.price;
            bValue = b.price;
            break;
          case 'vintage':
            aValue = a.vintage || 0;
            bValue = b.vintage || 0;
            break;
          default:
            aValue = a.averageScore;
            bValue = b.averageScore;
        }
        
        if (sortOrder === 'desc') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });
      
      res.json({
        wines: filteredWines,
        total: filteredWines.length,
        filters: {
          search,
          vintage,
          region,
          grapeVariety,
          minRating,
          wineType,
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      console.error("Error fetching wine collection:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Phase 1: Get always-available conversation starters from database
  // This endpoint returns immediately without waiting for GPT
  app.get("/api/dashboard/:email/conversation-starters", async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    try {
      const starters = await storage.getConversationStarters(email);
      res.json(starters);
    } catch (error) {
      console.error("Error fetching conversation starters:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Phase 2: Get explore recommendations ("You liked X → Try Y")
  // Returns region or grape recommendations with explanations
  app.get("/api/dashboard/:email/explore-recommendations", async (req, res) => {
    const { email } = req.params;
    const { type = 'region' } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    // Validate type parameter
    const recommendationType = type === 'grape' ? 'grape' : 'region';

    try {
      const recommendations = await storage.getExploreRecommendations(email, recommendationType);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching explore recommendations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Phase 3: Get producer recommendations by price tier (LLM-powered)
  // Returns specific wines to buy based on user preferences and budget
  app.get("/api/dashboard/:email/producer-recommendations", async (req, res) => {
    const { email } = req.params;
    const { tier = 'budget' } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    // Validate tier parameter
    const priceTier = ['budget', 'mid', 'premium'].includes(tier as string)
      ? (tier as 'budget' | 'mid' | 'premium')
      : 'budget';

    try {
      const recommendations = await withAiCache(email, `producer_recs_${priceTier}`, () =>
        generateProducerRecommendations(email, priceTier)
      );
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating producer recommendations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Phase 4: Get recommended journeys based on taste preferences
  // Returns journeys scored by alignment with user's wine preferences
  app.get("/api/dashboard/:email/recommended-journeys", async (req, res) => {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    try {
      const recommendations = await storage.getJourneyRecommendations(email);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching journey recommendations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get AI-generated sommelier conversation starters
  app.get("/api/dashboard/:email/sommelier-tips", async (req, res) => {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }

    try {
      // Use cache: only recompute when tasting data changes
      const sommelierTips = await withAiCache(email, "sommelier_tips", () =>
        generateSommelierTips(email)
      );

      res.json(sommelierTips);
    } catch (error) {
      console.error("Error generating AI sommelier tips:", error);
      
      // Fallback to basic tips if LLM fails
      try {
        const dashboardData = await storage.getUserDashboardData(email);
        const scores = await storage.getUserWineScores(email);
        
        if (dashboardData && scores.scores) {
          const fallbackTips = generateLegacySommelierTips(dashboardData, scores.scores);
          res.json(fallbackTips);
        } else {
          throw new Error("No user data available");
        }
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        res.status(500).json({ 
          message: "Unable to generate sommelier tips", 
          error: "Both AI and fallback methods failed" 
        });
      }
    }
  });

  // Get session details for a specific user
  app.get("/api/dashboard/session/:sessionId/details", async (req, res) => {
    console.log(`[SESSION_DETAILS] Starting request for session: ${req.params.sessionId}, user: ${req.query.userEmail}`);
    
    try {
      const { sessionId } = req.params;
      const { userEmail } = req.query;

      if (!userEmail || typeof userEmail !== 'string') {
        return res.status(400).json({ message: "userEmail parameter is required" });
      }

      // Get session data
      const session = await storage.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!session.packageId) {
        return res.status(400).json({ message: "Session has no associated package" });
      }

      // Get session participants to find the user
      const participants = await storage.getParticipantsBySessionId(session.id);
      const userParticipant = participants.find(p => p.email === userEmail);
      
      if (!userParticipant) {
        return res.status(404).json({ message: "User not found in this session" });
      }

      // Get package data
      const packageData = await storage.getPackageById(session.packageId);
      if (!packageData) {
        return res.status(404).json({ message: "Package not found" });
      }

      // Get wine data for the package
      const wines = await storage.getPackageWines(session.packageId);
      
      // Get user's actual wine scores (this uses the working getUserWineScores method) 
      const userWineScores = await storage.getUserWineScores(userEmail);
      
      console.log(`[DEBUG] User has ${userWineScores.scores.length} total wine scores in their history`);

      // Bulk fetch all responses for all participants (1 query instead of P+1)
      const participantIds = participants.map(p => p.id);
      const allResponsesRaw = await db
        .select({
          response: responses,
          packageWineId: slides.packageWineId,
        })
        .from(responses)
        .leftJoin(slides, eq(responses.slideId, slides.id))
        .where(inArray(responses.participantId, participantIds));

      const allParticipantResponses = allResponsesRaw.map(r => ({
        ...r.response,
        package_wine_id: r.packageWineId || '',
      }));
      const userResponses = allParticipantResponses.filter(r => r.participantId === userParticipant.id);

      // Generate realistic wine scores based on user's history and session data
      const wineScores = wines.map((wine, index) => {
        // Find if user has tasted this specific wine before
        const existingScore = userWineScores.scores.find((score: any) => 
          score.wineName === wine.wineName && score.vintage === wine.vintage
        );
        
        // Generate realistic scores based on user's preferences
        let userScore = 0;
        let groupAverage = 0;
        let individualScores: any[] = [];
        
        userScore = storage.calculateAverageScore(userResponses.filter(r => r.package_wine_id === wine.id));
        groupAverage = storage.calculateAverageScore(allParticipantResponses.filter(r => r.package_wine_id === wine.id));

        // Generate individual participant scores around the group average
        for (let i = 0; i < participants.length; i++) {
          const participantScore = Math.max(1, Math.min(5, groupAverage + (Math.random() - 0.5) * 2));
          individualScores.push({
            participantId: participants[i].id,
            score: Math.round(participantScore * 10) / 10
          });
        }
        
        // Handle grape varietals safely
        const grapeVarietalsArray = Array.isArray(wine.grapeVarietals) ? wine.grapeVarietals : [];
        
        return {
          wineId: wine.id,
          wineName: wine.wineName,
          vintage: wine.vintage?.toString() || "N/A",
          region: wine.region || "Unknown",
          country: "Unknown", // Wine model doesn't have country field, can be added later
          grapeVarietal: grapeVarietalsArray.length > 0 ? grapeVarietalsArray[0] : "Unknown",
          individualScores,
          groupAverage: Math.round(groupAverage * 10) / 10,
          totalParticipants: participants.length,
          userScore: Math.round(userScore * 10) / 10
        };
      });

      // Mock sommelier data (can be enhanced later with real sommelier profiles)
      const mockSommelier = {
        name: "Wine Expert",
        title: "Master Sommelier",
        experience: "15+ years in wine education",
        specialties: ["French Wines", "Food Pairing", "Wine Education"],
        rating: 4.8,
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
      };

      // Generate sommelier observations based on session data and scores
      const avgGroupScore = wineScores.reduce((sum, wine) => sum + wine.groupAverage, 0) / wineScores.length;
      const avgUserScore = wineScores.reduce((sum, wine) => sum + wine.userScore, 0) / wineScores.length;
      
      // Get sommelier observations from participants (using the first participant for session-level observations)
      const sommelierObservations = participants[0]?.sommelier_feedback 
        ? participants[0].sommelier_feedback.split('\n').filter(obs => obs.trim()) 
        : [];

      const tastingDetailData = {
        session: {
          id: session.id,
          title: packageData.name || "Wine Tasting Session", 
          sommelier: mockSommelier,
          date: session.startedAt?.toISOString() || new Date().toISOString(),
          duration: session.completedAt && session.startedAt ? 
            Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / (1000 * 60)) : 
            90, // Default 90 minutes if not completed
          participants: participants.length,
          location: "Virtual Tasting Room", // Can be enhanced with real location data
          description: packageData.description || "A curated wine tasting experience featuring exceptional wines."
        },
        wines: wineScores,
        sommelierObservations,
        userParticipant,
        userNotes: "", // Can be enhanced with stored user notes
        overallRating: Math.round(avgUserScore * 10) / 10 // User's average rating for this session
      };

      console.log(`[SESSION_DETAILS] Successfully generated scores for ${wineScores.length} wines`);
      res.json(tastingDetailData);
    } catch (error) {
      console.error("Error getting session details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add a new route to update sommelier observations
  // TODO: Implement updateSommelierObservations method in storage
  /*
  app.post('/api/dashboard/session/:sessionId/update-observations', async (req, res) => {
    const { sessionId } = req.params;
    const { observations } = req.body;

    if (!observations || !Array.isArray(observations)) {
      return res.status(400).json({ error: 'Invalid observations format.' });
    }

    try {
      // Update the observations in the database
      await storage.updateSommelierObservations(sessionId, observations);

      res.status(200).json({ message: 'Observations updated successfully.' });
    } catch (error) {
      console.error('Error updating observations:', error);
      res.status(500).json({ error: 'Failed to update observations.' });
    }
  });
  */

  // Agent-native endpoint: Get current user's dashboard summary without requiring email in URL
  // This endpoint is designed for automated workflows and AI agents
  app.get("/api/me/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userEmail = req.session.userEmail;

      if (!userId || !userEmail) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get user info
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get recent solo tastings
      const recentTastings = await db
        .select()
        .from(tastings)
        .where(eq(tastings.userId, userId))
        .orderBy(desc(tastings.tastedAt))
        .limit(5);

      // Get tasting stats
      const statsResult = await db
        .select({
          totalTastings: sql<number>`count(*)`,
          avgOverallRating: sql<number>`avg((responses->'overall'->>'rating')::numeric)`
        })
        .from(tastings)
        .where(eq(tastings.userId, userId));

      const stats = statsResult[0] || { totalTastings: 0, avgOverallRating: null };

      // Get active journeys count
      const activeJourneys = await storage.getUserActiveJourneys(userEmail);

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          tastingLevel: user.tastingLevel,
          tastingsCompleted: user.tastingsCompleted,
          levelUpPromptEligible: user.levelUpPromptEligible,
          createdAt: user.createdAt
        },
        stats: {
          totalSoloTastings: Number(stats.totalTastings),
          averageRating: stats.avgOverallRating ? Number(stats.avgOverallRating).toFixed(1) : null,
          activeJourneys: activeJourneys.length
        },
        recentTastings: recentTastings.map(t => ({
          id: t.id,
          wineName: t.wineName,
          wineType: t.wineType,
          tastedAt: t.tastedAt
        })),
        links: {
          // Agent-native: provide links for follow-up actions
          fullDashboard: `/api/dashboard/${encodeURIComponent(userEmail)}`,
          preferences: '/api/solo/preferences',
          recommendations: '/api/solo/recommendations',
          levelStatus: '/api/solo/level',
          tastings: '/api/solo/tastings'
        }
      });
    } catch (error) {
      console.error("Error fetching user summary:", error);
      return res.status(500).json({ error: "Failed to fetch user summary" });
    }
  });
}

  function getTopHalfByType(wines: any[], type: 'red' | 'white') {
    const typed = (wines || []).filter(w => (w.wineType || '').toLowerCase() === type);
    const sorted = [...typed].sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
    const half = Math.max(1, Math.ceil(sorted.length / 2));
    return sorted.slice(0, half);
  }

  function dedupStrings(values: Array<string | number | null | undefined>) {
    const out = new Set<string>();
    for (const v of values) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (!s) continue;
      out.add(s);
    }
    return Array.from(out);
  }

  function dedupNumbers(values: Array<number | string | null | undefined>) {
    const out = new Set<number>();
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v)) out.add(v);
    }
    return Array.from(out);
  }

  function buildTopTraits(topWines: any[]) {
    const bodies: Array<string> = [];
    const acidities: Array<number> = [];
    const sweetnesses: Array<string> = [];
    const fruits = new Set<string>();

    for (const w of topWines) {
      const ec = (w?.expectedCharacteristics || {}) as Record<string, any>;
      if (ec['Body'] !== undefined) bodies.push(String(ec['Body']));
      if (typeof ec['Acidity'] === 'number') acidities.push(ec['Acidity']);
      if (ec['Sweetness'] !== undefined) sweetnesses.push(String(ec['Sweetness']));
      Object.keys(ec).forEach((key) => {
        if (key.toLowerCase().includes('fruit') && ec[key]) fruits.add(key);
      });
    }

    const regionsTop3 = topWines
      .slice(0, 3)
      .map(w => w.region)
      .filter((r: any) => typeof r === 'string' && r.trim() !== '');

    return {
      traits: {body: dedupStrings(bodies),
      acidity: dedupNumbers(acidities),
      sweetness: dedupStrings(sweetnesses),
      fruits: Array.from(fruits),
      },
      regionsTop3
    };
  }


// Helper functions for generating enhanced dashboard data
async function generateTasteProfileAnalysis(wines: any[], dashboardData: any, userLevel: string = 'intro', totalWines: number = 0) {
  const redWines = wines.filter(w => w.wineType === 'red');
  const whiteWines = wines.filter(w => w.wineType === 'white');

  // Analyze red wine preferences
  const redProfile = analyzeWineTypeProfile(redWines, 'red');
  const whiteProfile = analyzeWineTypeProfile(whiteWines, 'white');

  const redTopHalf = getTopHalfByType(wines, 'red');
  const whiteTopHalf = getTopHalfByType(wines, 'white');
  const redTraits = buildTopTraits(redTopHalf);
  const whiteTraits = buildTopTraits(whiteTopHalf);

  const redWineData = { ...redProfile, ...redTraits };
  const whiteWineData = { ...whiteProfile, ...whiteTraits };

  let redSommelierSummary: string | undefined;
  let whiteSommelierSummary: string | undefined;
  try {
    // Note: taste-profile doesn't have email in scope here, so we compute directly.
    // The cache wrapping happens at the endpoint level instead.
    const summaries = await generateWineProfileSummaries(redWineData, whiteWineData, userLevel, totalWines);
    redSommelierSummary = summaries.redSummary;
    whiteSommelierSummary = summaries.whiteSummary;
  } catch (error) {
    console.error('❌ Failed to generate wine profile summaries:', error);
  }

  return {
    redWineProfile: { 
      ...redWineData, 
      summary: redSommelierSummary
    },
    whiteWineProfile: { 
      ...whiteWineData, 
      summary: whiteSommelierSummary 
    },
    overallStats: {
      totalWines: wines.length,
      averageRating: dashboardData.stats.averageScore,
      topRegion: dashboardData.topPreferences?.topRegion || { name: "None", count: 0, percentage: 0 },
      topGrape: dashboardData.topPreferences?.topGrape || { name: "None", count: 0, percentage: 0 }
    }
  };
}

function analyzeWineTypeProfile(wines: any[], type: string) {
  if (wines.length === 0) {
    return {
      stylePreference: "No data",
      preferredVarieties: [],
      favoriteRegions: [],
      commonFlavorNotes: []
    };
  }
  
  // Analyze grape varieties - use primary grape only for consistent counting
  const grapeCounts = new Map();
  wines.forEach(wine => {
    if (wine.grapeVarietals && wine.grapeVarietals.length > 0) {
      // Count only the primary (first) grape varietal to maintain consistent wine counts
      const primaryGrape = wine.grapeVarietals[0];
      grapeCounts.set(primaryGrape, (grapeCounts.get(primaryGrape) || 0) + 1);
    }
  });
  
  const preferredVarieties = Array.from(grapeCounts.entries())
    .map(([grape, count]) => ({
      grape,
      averageScore: wines.filter(w => w.grapeVarietals?.includes(grape))
        .reduce((sum, w) => sum + w.averageScore, 0) / count,
      count
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3);
  
  // Analyze regions
  const regionCounts = new Map();
  wines.forEach(wine => {
    if (wine.region) {
      regionCounts.set(wine.region, (regionCounts.get(wine.region) || 0) + 1);
    }
  });
  
  const favoriteRegions = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  // Generate style preference based on average characteristics
  const avgScore = wines.reduce((sum, w) => sum + w.averageScore, 0) / wines.length;
  let stylePreference = "Medium-bodied";
  if (avgScore >= 4.5) stylePreference = type === 'red' ? "Full-bodied" : "Rich & Full";
  else if (avgScore >= 4.0) stylePreference = "Medium-bodied";
  else stylePreference = type === 'red' ? "Light-bodied" : "Crisp & Light";
  
  // Generate flavor notes based on regions and grapes
  const flavorNotes = generateFlavorNotes(type, favoriteRegions, preferredVarieties);
  
  return {
    stylePreference,
    preferredVarieties,
    favoriteRegions,
    commonFlavorNotes: flavorNotes
  };
}

function generateFlavorNotes(type: string, regions: any[], varieties: any[]) {
  const flavorMap: Record<string, Record<string, string[]>> = {
    red: {
      'Bordeaux': ['Rich tannins', 'Dark fruit', 'Oak influence'],
      'Tuscany': ['Cherry notes', 'Herbal complexity', 'Earthy undertones'],
      'Napa Valley': ['Ripe fruit', 'Vanilla', 'Spice'],
      'default': ['Red fruit', 'Medium tannins', 'Balanced acidity']
    },
    white: {
      'Burgundy': ['Citrus notes', 'Mineral finish', 'Crisp acidity'],
      'Champagne': ['Brioche', 'Green apple', 'Fine bubbles'],
      'Loire Valley': ['Herbaceous', 'Citrus', 'Mineral'],
      'default': ['Citrus notes', 'Mineral finish', 'Crisp acidity']
    }
  };
  
  const typeFlavors = flavorMap[type] || flavorMap.white;
  
  if (regions.length > 0 && typeFlavors[regions[0].region]) {
    return typeFlavors[regions[0].region];
  }
  
  return typeFlavors.default;
}

function generateLegacySommelierTips(dashboardData: any, wines: any[]) {
  const topRegion = dashboardData.topPreferences?.topRegion?.name || "various regions";
  const topGrape = dashboardData.topPreferences?.topGrape?.name || "different grape varieties";
  const avgRating = dashboardData.stats.averageScore;
  
  const preferenceProfile = `I tend to enjoy wines from ${topRegion}, particularly ${topGrape}. My average rating for wines is around ${avgRating.toFixed(1)} stars.`;
  
  const redPreference = wines.filter(w => w.wineType === 'red').length > 0;
  const whitePreference = wines.filter(w => w.wineType === 'white').length > 0;
  
  let redDescription = "";
  let whiteDescription = "";
  
  if (redPreference) {
    const redWines = wines.filter(w => w.wineType === 'red');
    const topRedGrape = redWines.sort((a, b) => b.averageScore - a.averageScore)[0]?.grapeVarietals?.[0] || "red wines";
    redDescription = `For reds, I really enjoy ${topRedGrape} and prefer full-bodied styles.`;
  }
  
  if (whitePreference) {
    const whiteWines = wines.filter(w => w.wineType === 'white');
    const topWhiteGrape = whiteWines.sort((a, b) => b.averageScore - a.averageScore)[0]?.grapeVarietals?.[0] || "white wines";
    whiteDescription = `For whites, I gravitate toward ${topWhiteGrape} and enjoy rich & full wines.`;
  }
  
  const questions = [
    `Do you have any wines similar to ${topGrape} from ${topRegion}?`,
    "What would you recommend that's a step up from what I usually drink?",
    "I'm looking for something that pairs well with [your dish] but matches my taste for full-bodied reds.",
    "Can you suggest something from a region I haven't explored much but might fit my preferences?"
  ];
  
  const priceGuidance = `I typically enjoy wines in the range that would retail for around $${Math.round(avgRating * 25)}. I'm open to trying something new if you think it really fits my palate.`;
  
  return {
    preferenceProfile,
    redDescription,
    whiteDescription,
    questions,
    priceGuidance
  };
}

async function generateWineProfileSummaries(
  redWineTraits: any,
  whiteWineTraits: any,
  userLevel: string = 'intro',
  totalWines: number = 0
): Promise<{ redSummary: string; whiteSummary: string }> {
  if (!openai || !process.env.OPENAI_API_KEY) {
    console.warn("⚠️  OpenAI not configured for wine profile summaries");
    return {
      redSummary: "AI-powered wine profile analysis is not available.",
      whiteSummary: "AI-powered wine profile analysis is not available."
    };
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const promptPath = path.join(process.cwd(), 'prompts', 'wine_profile_summary.txt');

    let promptTemplate: string;
    try {
      promptTemplate = await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      console.error('Failed to read wine profile summary prompt template:', error);
      throw new Error('Wine profile summary prompt template not found');
    }

    const prompt = promptTemplate
      .replace('{userLevel}', userLevel)
      .replace('{totalWines}', totalWines.toString())
      .replace('{red_preferences}', JSON.stringify(redWineTraits, null, 2))
      .replace('{white_preferences}', JSON.stringify(whiteWineTraits, null, 2));

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2", // Using GPT-5.2 for complex wine profile analysis - needs strong reasoning
      messages: [
        {
          role: "system",
          content: `You are an expert sommelier creating personalized wine preference summaries. 
          Respond ONLY in valid JSON format with exactly two fields:
          {
            "redSummary": "<string summary of red wine preferences>",
            "whiteSummary": "<string summary of white wine preferences>"
          }
          Do not include any nested objects, arrays, or additional fields.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }
    console.log("response", response)

    let result: { redSummary: string; whiteSummary: string };
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!result.redSummary || !result.whiteSummary) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return {
      redSummary: result.redSummary,
      whiteSummary: result.whiteSummary
    };

  } catch (error) {
    console.error('Error generating wine profile summaries:', error);
    throw error;
  }
}

// Phase 3: Generate producer recommendations using LLM
async function generateProducerRecommendations(
  email: string,
  priceTier: 'budget' | 'mid' | 'premium'
): Promise<{
  recommendations: Array<{
    producerName: string;
    wineName: string;
    estimatedPrice: string;
    grapeVariety: string;
    region: string;
    whyForYou: string;
    whereToBuy: string[];
    tastingNotes: string;
  }>;
  priceDisclaimer: string;
  priceTier: string;
  generatedAt: string;
}> {
  if (!openai || !process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI not configured");
  }

  // Get user's taste profile data
  const dashboardData = await storage.getUserDashboardData(email);
  const wineScores = await storage.getUserWineScores(email);
  const conversationStarters = await storage.getConversationStarters(email);

  if (!dashboardData || !wineScores) {
    throw new Error("No user data available");
  }

  // Build user profile context
  const favoriteRegions = conversationStarters.favoriteRegion
    ? [conversationStarters.favoriteRegion.region]
    : [];
  const favoriteGrapes = conversationStarters.favoriteGrape
    ? [conversationStarters.favoriteGrape.grape]
    : [];

  // Determine preferred style
  const redWines = wineScores.scores.filter((w: any) => w.wineType === 'red');
  const whiteWines = wineScores.scores.filter((w: any) => w.wineType === 'white');
  const avgRedRating = redWines.length > 0
    ? redWines.reduce((sum: number, w: any) => sum + (w.averageScore || 0), 0) / redWines.length
    : 0;
  const avgWhiteRating = whiteWines.length > 0
    ? whiteWines.reduce((sum: number, w: any) => sum + (w.averageScore || 0), 0) / whiteWines.length
    : 0;

  let preferredStyle = "balanced between reds and whites";
  if (avgRedRating > avgWhiteRating + 0.5) preferredStyle = "bold red wines";
  else if (avgWhiteRating > avgRedRating + 0.5) preferredStyle = "crisp white wines";

  // Load prompt template
  const fs = await import('fs/promises');
  const path = await import('path');
  const promptPath = path.join(process.cwd(), 'prompts', 'producer_recommendations.txt');

  let promptTemplate: string;
  try {
    promptTemplate = await fs.readFile(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to read producer recommendations prompt:', error);
    throw new Error('Prompt template not found');
  }

  // Fill in the template
  const prompt = promptTemplate
    .replace('{favoriteRegions}', favoriteRegions.length > 0 ? favoriteRegions.join(', ') : 'exploring various regions')
    .replace('{favoriteGrapes}', favoriteGrapes.length > 0 ? favoriteGrapes.join(', ') : 'exploring various grapes')
    .replace('{avgRating}', (dashboardData.stats.averageScore || 0).toFixed(1))
    .replace('{preferredStyle}', preferredStyle)
    .replace('{bodyPreference}', 'medium to full-bodied') // Could be enhanced with actual preference data
    .replace('{totalWines}', String(wineScores.scores.length))
    .replace('{priceTier}', priceTier);

  // Call GPT
  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini", // Using mini for cost efficiency on structured output
    messages: [
      {
        role: "system",
        content: "You are a knowledgeable sommelier. Always recommend REAL wines from REAL producers with accurate pricing. Respond in valid JSON format only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 1000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error('No response from OpenAI');
  }

  let result: { recommendations: any[]; priceDisclaimer?: string };
  try {
    result = JSON.parse(responseContent);
  } catch (parseError) {
    console.error('Failed to parse producer recommendations:', responseContent);
    throw new Error('Invalid JSON response from OpenAI');
  }

  return {
    recommendations: result.recommendations || [],
    priceDisclaimer: result.priceDisclaimer || "Prices are approximate and may vary by location.",
    priceTier,
    generatedAt: new Date().toISOString()
  };
}
