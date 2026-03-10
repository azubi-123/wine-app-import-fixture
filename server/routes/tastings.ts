import type { Express, Request, Response } from "express";
import { db, sql as pgClient } from "../db";
import { tastings, users, insertTastingSchema, type TastingLevel, type TastingResponses } from "@shared/schema";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { requireAuth } from "./auth";
import { attachCharacteristicsToTasting } from "../wine-intelligence";
import { generateNextBottleRecommendations } from "../openai-client";
import { wineIntelQueue } from "../lib/background-queue";
import { unauthorized, notFound, validationError, internalError, forbidden } from "../lib/api-error";
import { trackTastingCompleted } from "../audos-integration";

// User preferences derived from tasting history
interface UserPreferences {
  sweetness: string | null;
  acidity: string | null;
  tannins: string | null;
  body: string | null;
  tasting_count: string | number;
}

// Raw SQL query result type
interface PreferencesQueryResult {
  rows?: UserPreferences[];
}

// Level-up thresholds
const LEVEL_UP_THRESHOLDS: Record<TastingLevel, number | null> = {
  intro: 10,         // After 10 tastings, eligible for intermediate
  intermediate: 25,  // After 25 tastings, eligible for advanced
  advanced: null     // Already at max level
};

/**
 * Check if user is eligible for level-up based on tasting count
 */
async function checkLevelUpEligibility(userId: number): Promise<{
  eligible: boolean;
  currentLevel: TastingLevel;
  tastingsCompleted: number;
  nextLevel?: TastingLevel;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!user) {
    return { eligible: false, currentLevel: 'intro', tastingsCompleted: 0 };
  }

  const currentLevel = user.tastingLevel as TastingLevel;
  const tastingsCompleted = user.tastingsCompleted;
  const threshold = LEVEL_UP_THRESHOLDS[currentLevel];

  if (threshold === null || tastingsCompleted < threshold) {
    return { eligible: false, currentLevel, tastingsCompleted };
  }

  // User has reached threshold and hasn't been prompted yet (or declined)
  const nextLevel: TastingLevel = currentLevel === 'intro' ? 'intermediate' : 'advanced';

  return {
    eligible: true,
    currentLevel,
    tastingsCompleted,
    nextLevel
  };
}

/**
 * Increment user's tasting count and check level-up eligibility
 * Uses atomic update to prevent race conditions
 */
async function incrementTastingCount(userId: number): Promise<void> {
  // Atomic update: increment count and check threshold in a single query
  // This prevents race conditions where multiple requests could both pass the threshold
  await db
    .update(users)
    .set({
      tastingsCompleted: sql`${users.tastingsCompleted} + 1`,
      // Set levelUpPromptEligible if reaching threshold (atomic check)
      levelUpPromptEligible: sql`
        CASE
          WHEN ${users.tastingLevel} = 'intro' AND ${users.tastingsCompleted} + 1 >= 10 THEN true
          WHEN ${users.tastingLevel} = 'intermediate' AND ${users.tastingsCompleted} + 1 >= 25 THEN true
          ELSE ${users.levelUpPromptEligible}
        END
      `
    })
    .where(eq(users.id, userId));
}

/**
 * Get user's taste preferences derived from their tastings
 */
async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const result = await db.execute(sql`
    SELECT
      AVG(COALESCE(
        (responses->'taste'->>'sweetness')::numeric,
        (responses->'structure'->>'sweetness')::numeric
      )) as sweetness,
      AVG(COALESCE(
        (responses->'taste'->>'acidity')::numeric,
        (responses->'structure'->>'acidity')::numeric
      )) as acidity,
      AVG(COALESCE(
        (responses->'taste'->>'tannins')::numeric,
        (responses->'structure'->>'tannins')::numeric
      )) as tannins,
      AVG(COALESCE(
        (responses->'taste'->>'body')::numeric,
        (responses->'structure'->>'body')::numeric
      )) as body,
      COUNT(*) as tasting_count
    FROM tastings
    WHERE user_id = ${userId}
  `);

  const row = Array.isArray(result) ? result[0] : (result as PreferencesQueryResult).rows?.[0];
  return (row as UserPreferences) || { sweetness: null, acidity: null, tannins: null, body: null, tasting_count: 0 };
}

/**
 * Format preferences as human-readable text
 */
function formatPreferences(prefs: UserPreferences): string {
  const descriptions: string[] = [];

  if (prefs.body !== null) {
    if (Number(prefs.body) > 3.5) descriptions.push('Full-bodied');
    else if (Number(prefs.body) < 2.5) descriptions.push('Light-bodied');
  }

  if (prefs.tannins !== null) {
    if (Number(prefs.tannins) > 3.5) descriptions.push('High tannins');
    else if (Number(prefs.tannins) < 2.5) descriptions.push('Low tannins');
  }

  if (prefs.acidity !== null) {
    if (Number(prefs.acidity) > 3.5) descriptions.push('High acidity');
    else if (Number(prefs.acidity) < 2.5) descriptions.push('Low acidity');
  }

  if (prefs.sweetness !== null) {
    if (Number(prefs.sweetness) > 3.5) descriptions.push('Off-dry to sweet');
    else if (Number(prefs.sweetness) < 2) descriptions.push('Bone dry');
  }

  return descriptions.length > 0
    ? `You prefer: ${descriptions.join(', ')}`
    : 'Complete more tastings to see your preferences';
}

interface WineRecommendation {
  name: string;
  region: string;
  grapeVariety: string;
  wineType: 'red' | 'white' | 'rosé' | 'sparkling';
  reason: string;
  characteristics: { sweetness: number; acidity: number; tannins: number; body: number };
}

/**
 * Generate wine recommendations based on user preferences
 */
function generateRecommendations(prefs: UserPreferences): WineRecommendation[] {
  const recommendations: WineRecommendation[] = [];
  const body = prefs.body ? Number(prefs.body) : 3;
  const tannins = prefs.tannins ? Number(prefs.tannins) : 3;
  const acidity = prefs.acidity ? Number(prefs.acidity) : 3;
  const sweetness = prefs.sweetness ? Number(prefs.sweetness) : 2;

  // High body, high tannins = bold reds
  if (body > 3 && tannins > 3) {
    recommendations.push({
      name: 'Barolo',
      region: 'Piedmont, Italy',
      grapeVariety: 'Nebbiolo',
      wineType: 'red',
      reason: 'Rich, full-bodied with firm tannins - perfect for bold wine lovers',
      characteristics: { sweetness: 1.5, acidity: 3.5, tannins: 4.5, body: 4.5 }
    });
    recommendations.push({
      name: 'Napa Valley Cabernet Sauvignon',
      region: 'Napa Valley, USA',
      grapeVariety: 'Cabernet Sauvignon',
      wineType: 'red',
      reason: 'Powerful and structured with dark fruit and oak complexity',
      characteristics: { sweetness: 1.5, acidity: 3, tannins: 4, body: 4.5 }
    });
  }

  // Medium body, lower tannins = elegant reds
  if (body >= 2.5 && body <= 3.5 && tannins < 3.5) {
    recommendations.push({
      name: 'Burgundy Pinot Noir',
      region: 'Burgundy, France',
      grapeVariety: 'Pinot Noir',
      wineType: 'red',
      reason: 'Elegant and refined with silky tannins and red fruit notes',
      characteristics: { sweetness: 1.5, acidity: 3.5, tannins: 2.5, body: 3 }
    });
  }

  // High acidity preference = crisp whites
  if (acidity > 3) {
    recommendations.push({
      name: 'Chablis',
      region: 'Burgundy, France',
      grapeVariety: 'Chardonnay',
      wineType: 'white',
      reason: 'Mineral-driven with bright acidity and citrus notes',
      characteristics: { sweetness: 1.5, acidity: 4, tannins: 1, body: 2.5 }
    });
    recommendations.push({
      name: 'Sancerre',
      region: 'Loire Valley, France',
      grapeVariety: 'Sauvignon Blanc',
      wineType: 'white',
      reason: 'Crisp and refreshing with herbaceous and citrus character',
      characteristics: { sweetness: 1.5, acidity: 4.5, tannins: 1, body: 2 }
    });
  }

  // Lower acidity, fuller body = richer whites
  if (acidity <= 3 && body > 3) {
    recommendations.push({
      name: 'California Chardonnay',
      region: 'Sonoma, USA',
      grapeVariety: 'Chardonnay',
      wineType: 'white',
      reason: 'Rich and creamy with vanilla and tropical fruit notes',
      characteristics: { sweetness: 2, acidity: 2.5, tannins: 1, body: 4 }
    });
  }

  // Sweetness preference = off-dry/sweet wines
  if (sweetness > 2.5) {
    recommendations.push({
      name: 'Mosel Riesling Spätlese',
      region: 'Mosel, Germany',
      grapeVariety: 'Riesling',
      wineType: 'white',
      reason: 'Off-dry with honeyed stone fruit balanced by racy acidity',
      characteristics: { sweetness: 3.5, acidity: 4.5, tannins: 1, body: 2.5 }
    });
  }

  // Add sparkling if no strong preferences or variety
  if (recommendations.length < 3) {
    recommendations.push({
      name: 'Champagne Brut',
      region: 'Champagne, France',
      grapeVariety: 'Chardonnay, Pinot Noir, Pinot Meunier',
      wineType: 'sparkling',
      reason: 'Versatile and celebratory with fine bubbles and complexity',
      characteristics: { sweetness: 1.5, acidity: 4, tannins: 1, body: 2.5 }
    });
  }

  // Default exploration wines for new users
  if (recommendations.length === 0) {
    recommendations.push(
      {
        name: 'Côtes du Rhône',
        region: 'Rhône Valley, France',
        grapeVariety: 'Grenache, Syrah, Mourvèdre',
        wineType: 'red',
        reason: 'A great starting point - approachable with ripe fruit and spice',
        characteristics: { sweetness: 2, acidity: 3, tannins: 3, body: 3.5 }
      },
      {
        name: 'New Zealand Sauvignon Blanc',
        region: 'Marlborough, New Zealand',
        grapeVariety: 'Sauvignon Blanc',
        wineType: 'white',
        reason: 'Vibrant and expressive - perfect for discovering white wine',
        characteristics: { sweetness: 1.5, acidity: 4, tannins: 1, body: 2.5 }
      }
    );
  }

  return recommendations.slice(0, 4); // Return top 4 recommendations
}

/**
 * Register solo tasting routes
 */
export function registerTastingsRoutes(app: Express): void {
  // Create a new tasting (authenticated)
  // No rate limit on save itself - AI jobs run in background
  app.post("/api/solo/tastings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      // Validate input
      const parseResult = insertTastingSchema.safeParse({
        userId,
        ...req.body
      });

      if (!parseResult.success) {
        return validationError(res, "Invalid tasting data", parseResult.error.errors);
      }

      const tastingData = parseResult.data;

      // P2-006 & P2-007: Use transaction to ensure atomicity and return updated user state
      const result = await db.transaction(async (tx) => {
        // Insert the tasting
        const [newTasting] = await tx.insert(tastings).values({
          userId,
          wineName: tastingData.wineName,
          wineRegion: tastingData.wineRegion || null,
          wineVintage: tastingData.wineVintage || null,
          grapeVariety: tastingData.grapeVariety || null,
          wineType: tastingData.wineType || null,
          photoUrl: tastingData.photoUrl || null,
          responses: tastingData.responses
        }).returning();

        // Atomic update: increment count and check threshold, return updated state
        const [updatedUser] = await tx
          .update(users)
          .set({
            tastingsCompleted: sql`${users.tastingsCompleted} + 1`,
            // Set levelUpPromptEligible if reaching threshold (atomic check)
            levelUpPromptEligible: sql`
              CASE
                WHEN ${users.tastingLevel} = 'intro' AND ${users.tastingsCompleted} + 1 >= 10 THEN true
                WHEN ${users.tastingLevel} = 'intermediate' AND ${users.tastingsCompleted} + 1 >= 25 THEN true
                ELSE ${users.levelUpPromptEligible}
              END
            `
          })
          .where(eq(users.id, userId))
          .returning({
            tastingLevel: users.tastingLevel,
            tastingsCompleted: users.tastingsCompleted,
            levelUpPromptEligible: users.levelUpPromptEligible
          });

        return { newTasting, updatedUser };
      });

      const { newTasting, updatedUser } = result;

      // P1-005: Use background queue with retries instead of fire-and-forget
      wineIntelQueue.add(
        `wine-characteristics-${newTasting.id}`,
        () => attachCharacteristicsToTasting(newTasting.id)
      );

      wineIntelQueue.add(
        `recommendations-${newTasting.id}`,
        async () => {
          const recommendations = await generateNextBottleRecommendations(
            {
              wineName: tastingData.wineName,
              grapeVariety: tastingData.grapeVariety || undefined,
              wineRegion: tastingData.wineRegion || undefined,
              wineType: tastingData.wineType || undefined
            },
            tastingData.responses as TastingResponses
          );
          await db
            .update(tastings)
            .set({ recommendations })
            .where(eq(tastings.id, newTasting.id));
          console.log(`Recommendations saved for tasting ${newTasting.id}`);
        }
      );

      // P2-007: Use the RETURNED value from transaction, not a stale read
      const currentLevel = updatedUser.tastingLevel as TastingLevel;
      const isEligible = updatedUser.levelUpPromptEligible;
      const nextLevel: TastingLevel | undefined = isEligible
        ? (currentLevel === 'intro' ? 'intermediate' : 'advanced')
        : undefined;

      if (req.session.userEmail) {
        trackTastingCompleted(req.session.userEmail);
      }

      return res.status(201).json({
        tasting: newTasting,
        message: "Tasting saved successfully",
        levelUp: isEligible ? {
          eligible: true,
          currentLevel,
          nextLevel,
          tastingsCompleted: updatedUser.tastingsCompleted
        } : undefined
      });
    } catch (error) {
      console.error("Error saving tasting:", error);
      return internalError(res, "Failed to save tasting");
    }
  });

  // Get user's tastings (authenticated)
  // P3-010: Added filtering support for agent-native access
  app.get("/api/solo/tastings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const offset = parseInt(req.query.offset as string) || 0;

      // P3-010: Support filters for agent-native access
      const { grape, region, wineType, minRating } = req.query;

      // Build conditions array
      const conditions = [eq(tastings.userId, userId)];

      if (grape && typeof grape === 'string') {
        conditions.push(ilike(tastings.grapeVariety, `%${grape}%`));
      }
      if (region && typeof region === 'string') {
        conditions.push(ilike(tastings.wineRegion, `%${region}%`));
      }
      if (wineType && typeof wineType === 'string') {
        conditions.push(eq(tastings.wineType, wineType));
      }

      const userTastings = await db
        .select()
        .from(tastings)
        .where(and(...conditions))
        .orderBy(desc(tastings.tastedAt))
        .limit(limit)
        .offset(offset);

      // Filter by minRating in memory (JSON field)
      let filteredTastings = userTastings;
      if (minRating && typeof minRating === 'string') {
        const minRatingNum = parseInt(minRating);
        if (!isNaN(minRatingNum)) {
          filteredTastings = userTastings.filter(t => {
            const responses = t.responses as TastingResponses | null;
            const rating = responses?.overall?.rating;
            return rating !== undefined && rating >= minRatingNum;
          });
        }
      }

      // Get total count with filters
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tastings)
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      return res.json({
        tastings: filteredTastings,
        total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching tastings:", error);
      return internalError(res, "Failed to fetch tastings");
    }
  });

  // Get a single tasting by ID (authenticated, must be owner)
  app.get("/api/solo/tastings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const tastingId = parseInt(req.params.id);

      if (!userId) {
        return unauthorized(res);
      }

      if (isNaN(tastingId)) {
        return validationError(res, "Invalid tasting ID");
      }

      const tasting = await db.query.tastings.findFirst({
        where: eq(tastings.id, tastingId)
      });

      if (!tasting) {
        return notFound(res, "Tasting");
      }

      if (tasting.userId !== userId) {
        return forbidden(res, "Not authorized to view this tasting");
      }

      return res.json({ tasting });
    } catch (error) {
      console.error("Error fetching tasting:", error);
      return internalError(res, "Failed to fetch tasting");
    }
  });

  // P3-010: Update a tasting (authenticated, must be owner)
  app.patch("/api/solo/tastings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const tastingId = parseInt(req.params.id);

      if (!userId) {
        return unauthorized(res);
      }

      if (isNaN(tastingId)) {
        return validationError(res, "Invalid tasting ID");
      }

      // Check ownership
      const tasting = await db.query.tastings.findFirst({
        where: eq(tastings.id, tastingId)
      });

      if (!tasting) {
        return notFound(res, "Tasting");
      }

      if (tasting.userId !== userId) {
        return forbidden(res, "Not authorized to update this tasting");
      }

      // Only allow updating specific fields
      const allowedUpdates: Partial<typeof tastings.$inferInsert> = {};
      const { wineName, wineRegion, wineVintage, grapeVariety, wineType, responses } = req.body;

      if (wineName !== undefined) allowedUpdates.wineName = wineName;
      if (wineRegion !== undefined) allowedUpdates.wineRegion = wineRegion;
      if (wineVintage !== undefined) allowedUpdates.wineVintage = wineVintage;
      if (grapeVariety !== undefined) allowedUpdates.grapeVariety = grapeVariety;
      if (wineType !== undefined) allowedUpdates.wineType = wineType;
      if (responses !== undefined) allowedUpdates.responses = responses;

      if (Object.keys(allowedUpdates).length === 0) {
        return validationError(res, "No valid fields to update");
      }

      const [updated] = await db
        .update(tastings)
        .set(allowedUpdates)
        .where(eq(tastings.id, tastingId))
        .returning();

      return res.json({ tasting: updated, message: "Tasting updated" });
    } catch (error) {
      console.error("Error updating tasting:", error);
      return internalError(res, "Failed to update tasting");
    }
  });

  // Delete a tasting (authenticated, must be owner)
  app.delete("/api/solo/tastings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const tastingId = parseInt(req.params.id);

      if (!userId) {
        return unauthorized(res);
      }

      if (isNaN(tastingId)) {
        return validationError(res, "Invalid tasting ID");
      }

      // Check ownership
      const tasting = await db.query.tastings.findFirst({
        where: eq(tastings.id, tastingId)
      });

      if (!tasting) {
        return notFound(res, "Tasting");
      }

      if (tasting.userId !== userId) {
        return forbidden(res, "Not authorized to delete this tasting");
      }

      await db.delete(tastings).where(eq(tastings.id, tastingId));

      return res.json({ success: true, message: "Tasting deleted" });
    } catch (error) {
      console.error("Error deleting tasting:", error);
      return internalError(res, "Failed to delete tasting");
    }
  });

  // Get user's taste preferences (authenticated)
  app.get("/api/solo/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      const prefs = await getUserPreferences(userId);
      const summary = formatPreferences(prefs);

      return res.json({
        preferences: {
          sweetness: prefs.sweetness ? Number(prefs.sweetness) : null,
          acidity: prefs.acidity ? Number(prefs.acidity) : null,
          tannins: prefs.tannins ? Number(prefs.tannins) : null,
          body: prefs.body ? Number(prefs.body) : null
        },
        tastingCount: Number(prefs.tasting_count),
        summary
      });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      return internalError(res, "Failed to fetch preferences");
    }
  });

  // Get wine recommendations based on user preferences (authenticated)
  app.get("/api/solo/recommendations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      const prefs = await getUserPreferences(userId);
      const recommendations = generateRecommendations(prefs);

      return res.json({
        recommendations,
        basedOnTastings: Number(prefs.tasting_count)
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      return internalError(res, "Failed to fetch recommendations");
    }
  });

  // Get user's tasting level status (authenticated)
  app.get("/api/solo/level", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return notFound(res, "User");
      }

      const levelUpStatus = await checkLevelUpEligibility(userId);

      return res.json({
        tastingLevel: user.tastingLevel,
        tastingsCompleted: user.tastingsCompleted,
        levelUpEligible: levelUpStatus.eligible,
        nextLevel: levelUpStatus.nextLevel,
        thresholds: {
          intro: LEVEL_UP_THRESHOLDS.intro,
          intermediate: LEVEL_UP_THRESHOLDS.intermediate
        }
      });
    } catch (error) {
      console.error("Error fetching level status:", error);
      return internalError(res, "Failed to fetch level status");
    }
  });

  // Accept level-up (authenticated)
  // Uses atomic conditional update to prevent race conditions
  app.post("/api/solo/level/upgrade", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      // Atomic conditional update: only upgrade if eligible and update in single query
      // This prevents double level-ups from race conditions
      const result = await db
        .update(users)
        .set({
          tastingLevel: sql`
            CASE
              WHEN ${users.levelUpPromptEligible} = true AND ${users.tastingLevel} = 'intro' THEN 'intermediate'
              WHEN ${users.levelUpPromptEligible} = true AND ${users.tastingLevel} = 'intermediate' THEN 'advanced'
              ELSE ${users.tastingLevel}
            END
          `,
          levelUpPromptEligible: false
        })
        .where(sql`${users.id} = ${userId} AND ${users.levelUpPromptEligible} = true`)
        .returning();

      if (result.length === 0) {
        return validationError(res, "Not eligible for level-up");
      }

      const updatedUser = result[0];

      return res.json({
        success: true,
        newLevel: updatedUser.tastingLevel,
        message: `Congratulations! You've leveled up to ${updatedUser.tastingLevel}!`
      });
    } catch (error) {
      console.error("Error upgrading level:", error);
      return internalError(res, "Failed to upgrade level");
    }
  });

  // Decline level-up for now (authenticated) - will be asked again later
  app.post("/api/solo/level/decline", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return unauthorized(res);
      }

      // Just mark as not eligible for now (will be re-checked at next milestone)
      await db
        .update(users)
        .set({ levelUpPromptEligible: false })
        .where(eq(users.id, userId));

      return res.json({
        success: true,
        message: "No problem! We'll ask again after a few more tastings."
      });
    } catch (error) {
      console.error("Error declining level-up:", error);
      return internalError(res, "Failed to decline level-up");
    }
  });
}
