import {
  type Package,
  type InsertPackage,
  type PackageWine,
  type InsertPackageWine,
  type Slide,
  type InsertSlide,
  type Session,
  type InsertSession,
  type SessionWineSelection,
  type InsertSessionWineSelection,
  type Participant,
  type InsertParticipant,
  type Response,
  type InsertResponse,
  type Media,
  type InsertMedia,
  type GlossaryTerm,
  type InsertGlossaryTerm,
  type SommelierTips,
  type ConversationStarters,
  type LikedWine,
  type ExploreRecommendation,
  type JourneyRecommendationsResponse,
  type JourneyMatch,
  type User,
  type Tasting,
  type Journey,
  type InsertJourney,
  type Chapter,
  type InsertChapter,
  type UserJourney,
  type InsertUserJourney,
  type CompletedChapter,
  type SommelierChat,
  type InsertSommelierChat,
  type SommelierMessage,
  type InsertSommelierMessage,
  packages,
  packageWines,
  slides,
  sessions,
  sessionWineSelections,
  participants,
  responses,
  media,
  glossaryTerms,
  wineCharacteristics,
  wineResponseAnalytics,
  users,
  tastings,
  journeys,
  chapters,
  userJourneys,
  sommelierChats,
  sommelierMessages,
  aiResponseCache,
  type AiResponseCache,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc, gte, lt, asc, ne, sql, gt, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { openai } from "./lib/openai";
import { 
  updateSlidePositionSafely, 
  calculateNewSlidePosition, 
  renumberSectionSlides,
  shouldRenumberSection,
  findNearestFreePosition,
  getPositionBetween,
  type SectionType 
} from "./position-manager";

// Utility function to generate unique short codes
async function generateUniqueShortCode(length: number = 6): Promise<string> {
  const characters = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // Removed O, 0 to avoid confusion
  let attempts = 0;
  const maxAttempts = 20; // Increased max attempts

  while (attempts < maxAttempts) {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    const existingSession = await db.query.sessions.findFirst({
      columns: { id: true }, // Only fetch necessary column for existence check
      where: eq(sessions.short_code, result),
    });

    if (!existingSession) {
      return result;
    }
    attempts++;
  }
  // Fallback if a unique code can't be generated (highly unlikely for 6 chars from 34 options if table isn't enormous)
  console.error(
    `Failed to generate a unique ${length}-char code after ${maxAttempts} attempts. Falling back.`,
  );
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
    .toUpperCase();
}

export interface IStorage {
  // Packages
  getPackageByCode(code: string): Promise<Package | undefined>;
  getPackageById(id: string): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  generateUniqueShortCode(length: number): Promise<string>;

  // Package Wines
  createPackageWine(wine: InsertPackageWine): Promise<PackageWine>;
  getPackageWines(packageId: string): Promise<PackageWine[]>;

  // Slides
  getSlidesByPackageWineId(packageWineId: string): Promise<Slide[]>;
  getSlideById(id: string): Promise<Slide | undefined>;
  createSlide(slide: InsertSlide): Promise<Slide>;

  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSessionById(
    id: string,
  ): Promise<(Session & { packageCode?: string }) | undefined>;
  updateSessionParticipantCount(
    sessionId: string,
    count: number,
  ): Promise<void>;
  updateSessionStatus(
    sessionId: string,
    status: string,
  ): Promise<Session | undefined>;

  // Session Wine Selections
  createSessionWineSelections(sessionId: string, selections: InsertSessionWineSelection[]): Promise<SessionWineSelection[]>;
  getSessionWineSelections(sessionId: string): Promise<(SessionWineSelection & { wine: PackageWine })[]>;
  updateSessionWineSelections(sessionId: string, selections: InsertSessionWineSelection[]): Promise<SessionWineSelection[]>;
  deleteSessionWineSelections(sessionId: string): Promise<void>;

  // Participants
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  getParticipantsBySessionId(sessionId: string): Promise<Participant[]>;
  updateParticipantProgress(
    participantId: string,
    progress: number,
  ): Promise<void>;

  // Responses
  createResponse(response: InsertResponse): Promise<Response>;
  getResponsesByParticipantId(participantId: string): Promise<Response[]>;
  getResponsesBySlideId(slideId: string): Promise<Response[]>;
  updateResponse(
    participantId: string,
    slideId: string,
    answerJson: any,
  ): Promise<Response>;

  // Analytics
  getAggregatedSessionAnalytics(sessionId: string): Promise<any>;
  getParticipantAnalytics(sessionId: string, participantId: string): Promise<any>;
  getSessionResponses(sessionId: string): Promise<any[]>;
  getSessionCompletionStatus(sessionId: string, wineId: string): Promise<any>;
  
  // Sentiment analysis methods
  getWineTextResponses(sessionId: string, wineId: string): Promise<any[]>;
  saveSentimentAnalysis(sessionId: string, wineId: string, results: any[]): Promise<void>;
  
  // Step 4: Average calculation methods
  calculateWineQuestionAverages(sessionId: string, wineId: string): Promise<any[]>;

  // Package management for sommelier dashboard
  getAllPackages(): Promise<Package[]>;
  updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package>;
  deletePackage(id: string): Promise<void>;
  getAllSessions(): Promise<Session[]>;

  // Wine management for sommelier dashboard
  createPackageWineFromDashboard(wine: InsertPackageWine): Promise<PackageWine>;
  updatePackageWine(id: string, data: Partial<InsertPackageWine>): Promise<PackageWine>;
  deletePackageWine(id: string): Promise<void>;

  // Slide management for slide editor
  updateSlide(id: string, data: Partial<InsertSlide>): Promise<Slide>;
  deleteSlide(id: string): Promise<void>;

  // Glossary
  getGlossaryTerms(): Promise<GlossaryTerm[]>;
  createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm>;

  // Wine Characteristics
  getWineCharacteristics(): Promise<any[]>;
  
  // Slide position operations
  updateSlidePosition(slideId: string, newPosition: number): Promise<void>;
  normalizeSlidePositions(packageWineId: string): Promise<void>;
  
  // Slide duplication
  duplicateWineSlides(sourceWineId: string, targetWineId: string, replaceExisting: boolean): Promise<{ count: number; slides: Slide[] }>;
  
  // Media
  createMedia(media: InsertMedia): Promise<Media>;
  getMediaByPublicId(publicId: string): Promise<Media | undefined>;
  getMediaById(id: string): Promise<Media | undefined>;
  updateMediaLastAccessed(id: string): Promise<void>;
  deleteMedia(id: string): Promise<void>;
  generateUniqueMediaPublicId(): Promise<string>;

  // User Dashboard
  getAllParticipantsByEmail(email: string): Promise<Participant[]>;
  getUserDashboardData(email: string): Promise<any>;
  getUserWineScores(email: string): Promise<any>;
  getUserTastingHistory(email: string, options: { limit: number; offset: number }): Promise<any>;
  getUserSommelierFeedback(email: string): Promise<string[]>;

  // Unified Tasting Data (Sprint 2.5 - Solo + Group)
  getUserByEmail(email: string): Promise<User | undefined>;
  getSoloTastingsByEmail(email: string): Promise<Tasting[]>;
  getUnifiedTastingStats(email: string): Promise<{ total: number; solo: number; group: number }>;

  // LLM Integration
  generateSommelierTips(email: string): Promise<SommelierTips>;

  // Score calculation
  calculateAverageScore(userResponses: Response[]): number;

  // Sommelier Chat
  getActiveSommelierChat(userId: number): Promise<SommelierChat | undefined>;
  createSommelierChat(chat: InsertSommelierChat): Promise<SommelierChat>;
  getSommelierChatMessages(chatId: number, limit?: number): Promise<SommelierMessage[]>;
  createSommelierMessage(message: InsertSommelierMessage): Promise<SommelierMessage>;
  updateSommelierChat(chatId: number, data: Partial<{ title: string; summary: string; lastSummaryAt: Date; messageCount: number; updatedAt: Date }>): Promise<void>;
  archiveSommelierChat(chatId: number): Promise<void>;
  getUncompactedMessages(chatId: number, keepRecent: number): Promise<SommelierMessage[]>;
  markMessagesCompacted(messageIds: number[]): Promise<void>;
  getUserSommelierChats(userId: number): Promise<SommelierChat[]>;
  getSommelierChatById(chatId: number, userId: number): Promise<SommelierChat | undefined>;
  deleteSommelierChat(chatId: number): Promise<void>;

  // AI Response Cache
  getTastingFingerprint(email: string): Promise<string>;
  getAiResponseCache(email: string, cacheKey: string): Promise<AiResponseCache | undefined>;
  setAiResponseCache(email: string, cacheKey: string, fingerprint: string, responseData: any): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // In-memory storage for sentiment analysis results
  private sentimentAnalysisResults: Map<string, any[]> = new Map();

  // 5-second memo cache for getAllParticipantsByEmail (dedup repeated queries)
  private participantMemo: Map<string, { data: Participant[]; timestamp: number }> = new Map();
  private static PARTICIPANT_MEMO_TTL_MS = 5000;
  
  constructor() {
    this.initializeWineTastingData();
  }

  private async initializeWineTastingData() {
    // Check if data already exists
    const existingPackage = await this.getPackageByCode("WINE01");
    if (existingPackage) {
      return; // Data already exists
    }

    console.log("Initializing wine tasting data...");

    // Initialize glossary terms first
    await this.initializeGlossaryTerms();

    // Create the Bordeaux wine package
    const bordeauxPackage = await this.createPackage({
      code: "WINE01",
      name: "Bordeaux Discovery Collection",
      description:
        "Explore the finest wines from France's most prestigious region",
      sommelierId: null,
    });

    // Create additional packages
    const tuscanyPackage = await this.createPackage({
      code: "PABL01",
      name: "Tuscany Masterclass",
      description: "Journey through the rolling hills of Tuscany with exceptional Italian wines",
      sommelierId: null,
    });

    const napaPackage = await this.createPackage({
      code: "NAPA01",
      name: "Napa Valley Prestige",
      description: "Premium Californian wines from world-renowned Napa Valley",
      sommelierId: null,
    });

    // Create wines for Bordeaux package
    const chateauMargaux = await this.createPackageWine({
      packageId: bordeauxPackage.id,
      position: 1,
      wineName: "2018 Château Margaux",
      wineDescription: "A legendary Bordeaux from one of the most prestigious estates. Elegant and refined first growth with notes of blackcurrant, violets, and subtle oak.",
      wineImageUrl: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    const chateauLatour = await this.createPackageWine({
      packageId: bordeauxPackage.id,
      position: 2,
      wineName: "2019 Château Latour",
      wineDescription: "A powerful and elegant wine from Pauillac's premier grand cru classé. Dense, structured wine with cassis, cedar, and graphite minerality.",
      wineImageUrl: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    const chateauYquem = await this.createPackageWine({
      packageId: bordeauxPackage.id,
      position: 3,
      wineName: "2016 Château d'Yquem",
      wineDescription: "Legendary Sauternes dessert wine with honeyed apricot and botrytis complexity. A masterpiece of sweetness and acidity balance.",
      wineImageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    // Create wines for Tuscany package
    const brunello = await this.createPackageWine({
      packageId: tuscanyPackage.id,
      position: 1,
      wineName: "2017 Brunello di Montalcino",
      wineDescription: "Noble Sangiovese expressing the terroir of Montalcino with cherry, leather, and herbs. A wine of exceptional depth and complexity.",
      wineImageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    const chianti = await this.createPackageWine({
      packageId: tuscanyPackage.id,
      position: 2,
      wineName: "2019 Chianti Classico Riserva",
      wineDescription: "Traditional Tuscan blend with bright cherry, earth, and balanced oak aging. A perfect expression of Sangiovese.",
      wineImageUrl: "https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    // Create wines for Napa package
    const opusOne = await this.createPackageWine({
      packageId: napaPackage.id,
      position: 1,
      wineName: "2018 Opus One",
      wineDescription: "Iconic Bordeaux-style blend showcasing Napa's finest terroir with cassis and cedar. A collaboration between two wine legends.",
      wineImageUrl: "https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    const screamingEagle = await this.createPackageWine({
      packageId: napaPackage.id,
      position: 2,
      wineName: "2019 Screaming Eagle Cabernet",
      wineDescription: "Cult Napa Cabernet with intense concentration and power. Dark fruits, chocolate, and spice in perfect harmony.",
      wineImageUrl: "https://images.unsplash.com/photo-1506377872b23-6629d73b7e06?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
    });

    // Define slide templates that will be used for both wines
    const slideTemplates = [
      {
        position: 1,
        type: "interlude",
        section_type: "intro",
        payloadJson: {
          title: "Welcome to Your Wine Tasting",
          description: "Let's begin our journey through this exceptional wine",
        },
      },
      {
        position: 2,
        type: "question",
        section_type: "intro",
        payloadJson: {
          title: "What aromas do you detect?",
          description:
            "Take a moment to swirl and smell. Select all the aromas you can identify.",
          question_type: "multiple_choice",
          category: "Aroma",
          options: [
            {
              id: "1",
              text: "Dark fruits (blackberry, plum)",
              description: "Rich, concentrated berry aromas",
            },
            {
              id: "2",
              text: "Vanilla and oak",
              description: "From barrel aging",
            },
            {
              id: "3",
              text: "Spices (pepper, clove)",
              description: "Complex spice notes",
            },
            {
              id: "4",
              text: "Floral notes",
              description: "Violet or rose petals",
            },
            {
              id: "5",
              text: "Earth and minerals",
              description: "Terroir characteristics",
            },
          ],
          allow_multiple: true,
          allow_notes: true,
        },
      },
      {
        position: 3,
        type: "question",
        section_type: "deep_dive",
        payloadJson: {
          title: "Rate the aroma intensity",
          description:
            "How strong are the aromas? 1 = Very light, 10 = Very intense",
          question_type: "scale",
          category: "Intensity",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Very Light", "Very Intense"],
          backgroundImage: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&h=400&fit=crop",
        },
      },
      {
        position: 4,
        type: "question",
        section_type: "deep_dive",
        payloadJson: {
          title: "Describe the taste profile",
          description: "Take a sip and identify the flavors you experience.",
          question_type: "multiple_choice",
          category: "Taste",
          backgroundImage: "https://images.unsplash.com/photo-1574982817-a0138501b8e7?w=600&h=400&fit=crop",
          options: [
            {
              id: "1",
              text: "Red fruits (cherry, raspberry)",
              description: "Bright fruit flavors",
            },
            {
              id: "2",
              text: "Dark fruits (blackcurrant, plum)",
              description: "Rich, deep fruit flavors",
            },
            {
              id: "3",
              text: "Chocolate and coffee",
              description: "Rich, roasted notes",
            },
            {
              id: "4",
              text: "Tobacco and leather",
              description: "Aged, complex flavors",
            },
            {
              id: "5",
              text: "Herbs and spices",
              description: "Savory elements",
            },
          ],
          allow_multiple: true,
          allow_notes: true,
        },
      },
      {
        position: 5,
        type: "question",
        section_type: "deep_dive",
        payloadJson: {
          title: "How would you describe the body?",
          description: "The weight and fullness of the wine in your mouth",
          question_type: "scale",
          category: "Body",
          scale_min: 1,
          scale_max: 5,
          scale_labels: ["Light Body", "Full Body"],
        },
      },
      {
        position: 6,
        type: "question",
        section_type: "deep_dive",
        payloadJson: {
          title: "Tannin level assessment",
          description:
            "How much dryness and grip do you feel on your gums and tongue?",
          question_type: "scale",
          category: "Tannins",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Soft Tannins", "Firm Tannins"],
        },
      },
      {
        position: 7,
        type: "question",
        section_type: "ending",
        payloadJson: {
          title: "How long is the finish?",
          description: "How long do the flavors linger after swallowing?",
          question_type: "scale",
          category: "Finish",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Short Finish", "Very Long Finish"],
        },
      },
      {
        position: 8,
        type: "video_message" as const,
        section_type: "ending",
        payloadJson: {
          title: "Sommelier's Tasting Notes",
          description: "Expert insights on this Bordeaux wine",
          video_url: "https://placeholder-video-url.com/bordeaux-tasting.mp4",
          poster_url: "https://placeholder-video-url.com/bordeaux-poster.jpg",
          autoplay: false,
          show_controls: true,
        },
      },
      {
        position: 9,
        type: "question" as const,
        section_type: "ending",
        payloadJson: {
          title: "Overall wine rating",
          description: "Your overall impression of this wine",
          question_type: "scale",
          category: "Overall",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Poor", "Excellent"],
        },
      },
    ];

    // Create package introduction slide for the first wine (acts as package intro)
    const firstWine = [chateauMargaux, chateauLatour, chateauYquem, brunello, chianti, opusOne, screamingEagle][0];

    // Create package introduction slide (position 1)
    await this.createSlide({
      packageWineId: firstWine.id,
      position: 1,
      type: "interlude",
      section_type: "intro",
      payloadJson: {
        title: "Welcome to Your Wine Tasting Experience",
        description: "You're about to embark on a journey through exceptional wines. Each wine has been carefully selected to showcase unique characteristics and flavors.",
        is_package_intro: true,
        package_name: "Premium Wine Tasting Collection",
        background_image: "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=800&h=600&fit=crop"
      },
    });

    // Create slides for all wines with proper positioning
    let globalPosition = 2; // Start after package intro

    for (const wine of [chateauMargaux, chateauLatour, chateauYquem, brunello, chianti, opusOne, screamingEagle]) {
      // Create wine introduction slide first
      await this.createSlide({
        packageWineId: wine.id,
        position: globalPosition++,
        type: "interlude",
        section_type: "intro",
        payloadJson: {
          title: `Meet ${wine.wineName}`,
          description: wine.wineDescription || `Discover the unique characteristics of this exceptional ${wine.wineType} wine.`,
          wine_name: wine.wineName,
          wine_image: wine.wineImageUrl,
          wine_type: wine.wineType,
          wine_region: wine.region,
          wine_vintage: wine.vintage,
          is_welcome: true,
          is_wine_intro: true
        },
      });

      // Create remaining slides for this wine
      for (const slideTemplate of slideTemplates.slice(1)) { // Skip the first template since we created wine intro
        let payloadJson = { ...slideTemplate.payloadJson };

        // Add wine context to all slides
        payloadJson = {
          ...payloadJson,
          wine_name: wine.wineName,
          wine_image: wine.wineImageUrl,
          wine_type: wine.wineType
        } as any;

        await this.createSlide({
          packageWineId: wine.id,
          position: globalPosition++,
          type: slideTemplate.type as "question" | "media" | "interlude" | "video_message" | "audio_message",
          section_type: slideTemplate.section_type as "intro" | "deep_dive" | "ending" | null,
          payloadJson: payloadJson,
        });
      }
    }

    console.log("Wine tasting data initialized successfully!");
  }

  // Package methods
  async getPackageByCode(code: string): Promise<Package | undefined> {
    const result = await db
      .select()
      .from(packages)
      .where(eq(packages.code, code.toUpperCase()))
      .limit(1);
    return result[0];
  }

  async getPackageById(id: string): Promise<Package | undefined> {
    const result = await db
      .select()
      .from(packages)
      .where(eq(packages.id, id))
      .limit(1);
    return result[0];
  }

  async generateUniqueShortCode(length: number = 6): Promise<string> {
    const characters = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // Removed O, 0 to avoid confusion
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      let result = "";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
      }

      // Check if this code already exists in packages table
      const existingPackage = await db.query.packages.findFirst({
        columns: { id: true },
        where: eq(packages.code, result),
      });

      if (!existingPackage) {
        return result;
      }
      attempts++;
    }

    // Fallback if a unique code can't be generated
    console.error(
      `Failed to generate a unique ${length}-char code after ${maxAttempts} attempts. Falling back.`,
    );
    return crypto
      .randomBytes(Math.ceil(length / 2))
      .toString("hex")
      .slice(0, length)
      .toUpperCase();
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    const result = await db
      .insert(packages)
      .values({
        code: pkg.code.toUpperCase(),
        name: pkg.name,
        description: pkg.description,
        imageUrl: pkg.imageUrl,
        sommelierId: pkg.sommelierId,
      })
      .returning();

    const newPackage = result[0];

    // Create package introduction slide directly attached to the package
    await this.createPackageSlide({
      packageId: newPackage.id,
      position: 1,
      type: "interlude",
      section_type: "intro",
      payloadJson: {
        title: `Welcome to ${pkg.name}`,
        description: pkg.description || "You're about to embark on an exceptional wine tasting journey.",
        is_package_intro: true,
        package_name: pkg.name,
        package_image: (pkg as any).imageUrl || "",
        background_image: (pkg as any).imageUrl || ""
      },
    });

    return newPackage;
  }

  // Package Wine methods
  async createPackageWine(wine: InsertPackageWine): Promise<PackageWine> {
    const result = await db
      .insert(packageWines)
      .values({
        packageId: wine.packageId,
        position: wine.position || 0, // Provide default value for undefined position
        wineName: wine.wineName,
        wineDescription: wine.wineDescription,
        wineImageUrl: wine.wineImageUrl,
        wineType: wine.wineType,
        region: wine.region,
        vintage: wine.vintage,
      })
      .returning();

    const newWine = result[0];

    // Don't create intro slide for the special "Package Introduction" wine
    if (wine.wineName !== "Package Introduction") {
      // Create wine introduction slide
      await this.createSlide({
        packageWineId: newWine.id,
        position: 1,
        type: "interlude",
        section_type: "intro",
        payloadJson: {
          title: `Meet ${wine.wineName}`,
          description: wine.wineDescription || `Discover the unique characteristics of this exceptional wine.`,
          wine_name: wine.wineName,
          wine_image: wine.wineImageUrl || "",
          wine_type: wine.wineType || "",
          wine_region: wine.region || "",
          wine_vintage: wine.vintage || "",
          is_welcome: true,
          is_wine_intro: true
        },
      });
    }

    return newWine;
  }

  async getPackageWines(packageId: string): Promise<PackageWine[]> {
    const result = await db
      .select()
      .from(packageWines)
      .where(eq(packageWines.packageId, packageId))
      .orderBy(packageWines.position);
    return result;
  }

  // Slide methods
  async getSlidesByPackageWineId(packageWineId: string): Promise<Slide[]> {
    const result = await db
      .select()
      .from(slides)
      .where(eq(slides.packageWineId, packageWineId))
      .orderBy(slides.globalPosition);
    return result;
  }

  async getSlidesByPackageWineIds(packageWineIds: string[]): Promise<Slide[]> {
    if (packageWineIds.length === 0) return [];
    return await db
      .select()
      .from(slides)
      .where(inArray(slides.packageWineId, packageWineIds))
      .orderBy(slides.globalPosition);
  }

  async getSlidesByPackageId(packageId: string): Promise<Slide[]> {
    const result = await db
      .select()
      .from(slides)
      .where(eq(slides.packageId, packageId))
      .orderBy(slides.position);
    return result;
  }

  async getSlideById(id: string): Promise<Slide | undefined> {
    const result = await db
      .select()
      .from(slides)
      .where(eq(slides.id, id))
      .limit(1);
    return result[0];
  }

  async createPackageSlide(slide: Omit<InsertSlide, 'packageWineId'> & { packageId: string }): Promise<Slide> {
    // Auto-assign position if not provided
    let targetPosition = slide.position;
    if (!targetPosition) {
      const existingSlides = await db.select({ position: slides.position })
        .from(slides)
        .where(eq(slides.packageId, slide.packageId))
        .orderBy(desc(slides.position))
        .limit(1);

      targetPosition = (existingSlides[0]?.position || 0) + 1;
    }

    // Package-level slides use negative global positions to ensure they come before wine slides
    const targetGlobalPosition = -targetPosition;

    const result = await db
      .insert(slides)
      .values({
        packageId: slide.packageId,
        packageWineId: null, // Package-level slides don't belong to a wine
        position: targetPosition,
        globalPosition: targetGlobalPosition,
        type: slide.type,
        section_type: slide.section_type,
        payloadJson: slide.payloadJson,
        genericQuestions: slide.genericQuestions,
      })
      .returning();

    return result[0];
  }

  async createSlide(slide: InsertSlide): Promise<Slide> {
    // Validate payload type and provide defaults
    if (!slide.payloadJson || typeof slide.payloadJson !== 'object') {
      console.log('[SLIDE_CREATE] No payload provided, using minimal default for slide type:', slide.type);
      // Provide minimal default payload based on slide type
      slide.payloadJson = this.getDefaultPayloadForSlideType(slide.type);
    } else if (Object.keys(slide.payloadJson).length === 0) {
      console.log('[SLIDE_CREATE] Empty payload provided, using minimal default for slide type:', slide.type);
      // Provide minimal default payload for empty objects
      slide.payloadJson = this.getDefaultPayloadForSlideType(slide.type);
    }

    // Log slide creation for debugging
    console.log('[SLIDE_CREATE] Creating slide:', {
      type: slide.type,
      section_type: slide.section_type,
      position: slide.position,
      payloadKeys: Object.keys(slide.payloadJson)
    });

    // For wine-specific slides, get the wine to determine global position
    if (!slide.packageWineId) {
      throw new Error('createSlide requires packageWineId. Use createPackageSlide for package-level slides.');
    }

    const wine = await db
      .select()
      .from(packageWines)
      .where(eq(packageWines.id, slide.packageWineId))
      .limit(1);

    if (!wine[0]) {
      throw new Error('Wine not found');
    }

    // Calculate global position based on wine position
    let targetGlobalPosition: number;

    // Special handling for package intro (position 0)
    if (slide.payloadJson?.is_package_intro) {
      targetGlobalPosition = 0;
    } else {
      // Calculate base position for this wine
      const wineBasePosition = wine[0].position * 1000;

      // Add section offset
      let sectionOffset = 0;
      const sectionType = slide.section_type || 'intro'; // Default to intro if not specified

      if (sectionType === 'intro') {
        sectionOffset = slide.payloadJson?.is_wine_intro ? 10 : 50; // Wine intro at 10, other intros after
      } else if (sectionType === 'deep_dive') {
        sectionOffset = 100;
      } else if (sectionType === 'ending' || sectionType === 'conclusion') {
        sectionOffset = 200;
      }

      // Find the next available position in this section
      const existingSlides = await db
        .select({ globalPosition: slides.globalPosition })
        .from(slides)
        .where(
          and(
            eq(slides.packageWineId, slide.packageWineId),
            gte(slides.globalPosition, wineBasePosition + sectionOffset),
            lt(slides.globalPosition, wineBasePosition + sectionOffset + 100)
          )
        )
        .orderBy(desc(slides.globalPosition))
        .limit(1);

      const lastPositionInSection = existingSlides[0]?.globalPosition || (wineBasePosition + sectionOffset);
      targetGlobalPosition = lastPositionInSection === (wineBasePosition + sectionOffset)
        ? wineBasePosition + sectionOffset
        : lastPositionInSection + 10; // Use 10 as gap
    }

    // Auto-assign local position if not provided
    let targetPosition = slide.position;
    if (!targetPosition) {
      const existingSlides = await db.select({ position: slides.position })
        .from(slides)
        .where(eq(slides.packageWineId, slide.packageWineId!))
        .orderBy(desc(slides.position))
        .limit(1);

      targetPosition = (existingSlides[0]?.position || 0) + 1;
    }

    // Check for existing slide with same globalPosition to prevent conflicts
    const conflictCheck = await db
      .select({ id: slides.id })
      .from(slides)
      .where(eq(slides.globalPosition, targetGlobalPosition))
      .limit(1);

    if (conflictCheck.length > 0) {
      console.log(`[SLIDE_CREATE] Position conflict detected at globalPosition ${targetGlobalPosition}, finding next available`);
      // Find next available globalPosition
      const nextAvailable = await db
        .select({ globalPosition: slides.globalPosition })
        .from(slides)
        .where(
          and(
            eq(slides.packageWineId, slide.packageWineId),
            gte(slides.globalPosition, targetGlobalPosition)
          )
        )
        .orderBy(asc(slides.globalPosition));

      // Find gap in positions
      let newGlobalPosition = targetGlobalPosition;
      for (const existing of nextAvailable) {
        if (existing.globalPosition !== newGlobalPosition) {
          break; // Found a gap
        }
        newGlobalPosition = existing.globalPosition + 1;
      }
      targetGlobalPosition = newGlobalPosition;
    }

    // Log detailed position info for debugging Wine 1 issues
    console.log(`[SLIDE_CREATE] Inserting slide with positions:`, {
      packageWineId: slide.packageWineId,
      winePosition: wine[0].position,
      section_type: slide.section_type,
      localPosition: targetPosition,
      globalPosition: targetGlobalPosition,
      slideType: slide.type
    });

    let result;
    try {
      result = await db
        .insert(slides)
        .values({
          packageWineId: slide.packageWineId,
          position: targetPosition,
          globalPosition: targetGlobalPosition,
          type: slide.type,
          section_type: slide.section_type,
          payloadJson: slide.payloadJson,
          genericQuestions: slide.genericQuestions,
        })
        .returning();
    } catch (dbError: any) {
      console.error(`[SLIDE_CREATE] Database error:`, {
        error: dbError,
        errorMessage: dbError?.message,
        errorCode: dbError?.code,
        errorDetail: dbError?.detail,
        attemptedValues: {
          packageWineId: slide.packageWineId,
          position: targetPosition,
          globalPosition: targetGlobalPosition,
          type: slide.type,
          section_type: slide.section_type
        }
      });

      // Check for specific constraint violations
      if (dbError.code === '23505') { // Unique constraint violation
        throw new Error(`Position conflict: A slide already exists at position ${targetPosition} for this wine. Please try again.`);
      }

      // Re-throw with more context
      throw new Error(`Failed to create slide: ${dbError.message || 'Database error'}`);
    }

    const newSlide = result[0];

    // Check for orphaned media records that need to be linked to this slide
    // Look for temporary IDs in the payload that might have associated media
    const payloadStr = JSON.stringify(slide.payloadJson);
    const tempIdPattern = /temp-question-\d+/g;
    const tempIds = payloadStr.match(tempIdPattern) || [];

    if (tempIds.length > 0) {
      console.log(`[SLIDE_CREATE] Found temporary IDs in payload, checking for orphaned media: ${tempIds.join(', ')}`);

      for (const tempId of tempIds) {
        await this.updateMediaEntityId(tempId, newSlide.id, 'slide');
      }
    }

    // Also check for media with publicId references in the payload
    if (slide.payloadJson) {
      const publicIds: string[] = [];

      // Check for video/audio publicId fields
      if (slide.payloadJson.video_publicId) publicIds.push(slide.payloadJson.video_publicId);
      if (slide.payloadJson.audio_publicId) publicIds.push(slide.payloadJson.audio_publicId);

      if (publicIds.length > 0) {
        console.log(`[SLIDE_CREATE] Found media publicIds in payload, updating entity references: ${publicIds.join(', ')}`);

        for (const publicId of publicIds) {
          await this.updateMediaByPublicId(publicId, newSlide.id);
        }
      }
    }

    return newSlide;
  }

  async updateMediaEntityId(originalEntityId: string, newEntityId: string, entityType: 'slide' | 'wine' | 'package'): Promise<void> {
    try {
      // Find media records with the temporary ID in metadata
      const orphanedMedia = await db
        .select()
        .from(media)
        .where(
          and(
            eq(media.entityType, entityType),
            eq(sql`metadata->>'originalEntityId'`, originalEntityId)
          )
        );

      if (orphanedMedia.length > 0) {
        console.log(`[MEDIA_UPDATE] Found ${orphanedMedia.length} orphaned media records for ${originalEntityId}`);

        // Update each media record with the real entity ID
        for (const record of orphanedMedia) {
          await db
            .update(media)
            .set({
              entityId: newEntityId,
              metadata: {
                ...(record.metadata || {}),
                originalEntityId,
                updatedAt: new Date().toISOString(),
                linkedAt: new Date().toISOString()
              }
            })
            .where(eq(media.id, record.id));

          console.log(`[MEDIA_UPDATE] Updated media ${record.publicId} from temp ID ${originalEntityId} to slide ${newEntityId}`);
        }
      }
    } catch (error) {
      console.error(`[MEDIA_UPDATE] Error updating media records:`, error);
      // Don't throw - this is a best-effort operation
    }
  }

  async updateMediaByPublicId(publicId: string, newEntityId: string): Promise<void> {
    try {
      const result = await db
        .update(media)
        .set({
          entityId: newEntityId,
          metadata: sql`jsonb_set(metadata, '{linkedAt}', to_jsonb(now()::text))`
        })
        .where(
          and(
            eq(media.publicId, publicId),
            isNull(media.entityId) // Only update if not already linked
          )
        );

      console.log(`[MEDIA_UPDATE] Updated media ${publicId} to entity ${newEntityId}`);
    } catch (error) {
      console.error(`[MEDIA_UPDATE] Error updating media by publicId:`, error);
      // Don't throw - this is a best-effort operation
    }
  }

  // Session methods
  async createSession(session: InsertSession): Promise<Session> {
    const uniqueShortCode = await generateUniqueShortCode(6);

    const result = await db
      .insert(sessions)
      .values({
        packageId: session.packageId,
        short_code: uniqueShortCode,
        status: session.status || "waiting", // Use provided status or default to 'waiting'
        completedAt: session.completedAt,
        activeParticipants: session.activeParticipants || 0,
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error("Failed to create session or return result.");
    }
    return result[0];
  }

  async getSessionById(
    id: string,
  ): Promise<(Session & { packageCode?: string }) | undefined> {
    let result: any[] = [];

    // Check if the ID looks like a UUID first
    const isUUID = id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // Check if it's a 6-character short code
    const isShortCode = id.length === 6 && id.match(/^[A-Z0-9]{6}$/);

    if (isUUID) {
      // Try to find by session ID (UUID)
      result = await db
        .select({
          id: sessions.id,
          packageId: sessions.packageId,
          short_code: sessions.short_code,
          status: sessions.status,
          startedAt: sessions.startedAt,
          completedAt: sessions.completedAt,
          activeParticipants: sessions.activeParticipants,
          updatedAt: sessions.updatedAt,
          packageCode: packages.code,
        })
        .from(sessions)
        .leftJoin(packages, eq(sessions.packageId, packages.id))
        .where(eq(sessions.id, id))
        .limit(1);
    } else if (isShortCode) {
      // Try to find by short code
      result = await db
        .select({
          id: sessions.id,
          packageId: sessions.packageId,
          short_code: sessions.short_code,
          status: sessions.status,
          startedAt: sessions.startedAt,
          completedAt: sessions.completedAt,
          activeParticipants: sessions.activeParticipants,
          updatedAt: sessions.updatedAt,
          packageCode: packages.code,
        })
        .from(sessions)
        .leftJoin(packages, eq(sessions.packageId, packages.id))
        .where(eq(sessions.short_code, id.toUpperCase()))
        .limit(1);
    } else {
      // If not UUID or short code, treat as package code and find most recent active session
      result = await db
        .select({
          id: sessions.id,
          packageId: sessions.packageId,
          short_code: sessions.short_code,
          status: sessions.status,
          startedAt: sessions.startedAt,
          completedAt: sessions.completedAt,
          activeParticipants: sessions.activeParticipants,
          updatedAt: sessions.updatedAt,
          packageCode: packages.code,
        })
        .from(sessions)
        .leftJoin(packages, eq(sessions.packageId, packages.id))
        .where(eq(packages.code, id.toUpperCase()))
        .orderBy(sessions.updatedAt)
        .limit(1);
    }

    const sessionData = result[0];
    if (!sessionData) return undefined;

    // Convert the result to match our expected type
    const session: Session & { packageCode?: string } = {
      id: sessionData.id,
      packageId: sessionData.packageId,
      short_code: sessionData.short_code,
      status: sessionData.status,
      startedAt: sessionData.startedAt,
      completedAt: sessionData.completedAt,
      activeParticipants: sessionData.activeParticipants,
      updatedAt: sessionData.updatedAt,
      packageCode: sessionData.packageCode || undefined,
    };

    return session;
  }

  async updateSessionParticipantCount(
    sessionId: string,
    count: number,
  ): Promise<void> {
    await db
      .update(sessions)
      .set({ activeParticipants: count })
      .where(eq(sessions.id, sessionId));
  }

  async updateSessionStatus(
    sessionId: string,
    status: string,
  ): Promise<Session | undefined> {
    // Add validation for allowed status values
    const allowedStatuses = ["waiting", "active", "paused", "completed"];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid session status: ${status}`);
    }

    const updatedSessions = await db
      .update(sessions)
      .set({
        status,
        updatedAt: sql`now()`,
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    return updatedSessions[0];
  }

  // Participant methods
  async createParticipant(
    participant: InsertParticipant,
  ): Promise<Participant> {
    // Enhanced logging for debugging
    console.log(`[STORAGE_TRACE] createParticipant called with:`, {
      sessionId: participant.sessionId,
      sessionIdType: typeof participant.sessionId,
      sessionIdLength: participant.sessionId?.length,
      email: participant.email,
      displayName: participant.displayName,
      isHost: participant.isHost
    });

    // Validate sessionId is a proper UUID before insertion
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!participant.sessionId || !uuidRegex.test(participant.sessionId)) {
      console.error(`[STORAGE_ERROR] Invalid sessionId format for participant creation:`, {
        sessionId: participant.sessionId,
        sessionIdType: typeof participant.sessionId,
        isValidFormat: participant.sessionId ? uuidRegex.test(participant.sessionId) : false
      });
      throw new Error(`Invalid sessionId format: ${participant.sessionId}. Expected UUID format.`);
    }

    try {
      console.log(`[STORAGE] Creating participant with data:`, JSON.stringify({
        sessionId: participant.sessionId,
        email: participant.email,
        displayName: participant.displayName,
        isHost: participant.isHost || false
      }, null, 2));

      // Log the exact values being inserted
      const insertValues = {
        sessionId: participant.sessionId,
        email: participant.email,
        displayName: participant.displayName,
        isHost: participant.isHost || false,
        progressPtr: participant.progressPtr || 0,
      };

      console.log(`[STORAGE_TRACE] About to insert participant with values:`, JSON.stringify(insertValues, null, 2));

      const result = await db
        .insert(participants)
        .values(insertValues)
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to create participant - no record returned from database');
      }

      console.log(`[STORAGE] Successfully created participant: ${result[0].id}`);
      return result[0];
    } catch (error: any) {
      console.error(`[STORAGE_ERROR] Failed to create participant:`, {
        error: error,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetail: error?.detail,
        errorTable: error?.table,
        errorColumn: error?.column,
        errorConstraint: error?.constraint,
        participantData: participant
      });
      throw error; // Re-throw to be handled by the route
    }
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const result = await db
      .select()
      .from(participants)
      .where(eq(participants.id, id))
      .limit(1);
    return result[0];
  }

  async getParticipantsBySessionId(sessionId: string): Promise<Participant[]> {
    return await db
      .select()
      .from(participants)
      .where(eq(participants.sessionId, sessionId));
  }

  async getParticipantByEmailInSession(sessionId: string, email: string): Promise<Participant | undefined> {
    const result = await db
      .select()
      .from(participants)
      .where(and(
        eq(participants.sessionId, sessionId),
        eq(participants.email, email)
      ))
      .limit(1);
    return result[0];
  }

  async updateParticipantProgress(
    participantId: string,
    progress: number,
  ): Promise<void> {
    await db
      .update(participants)
      .set({
        progressPtr: progress,
        lastActive: sql`now()`,
      })
      .where(eq(participants.id, participantId));
  }

  async updateParticipantDisplayName(
    participantId: string,
    displayName: string,
  ): Promise<void> {
    await db
      .update(participants)
      .set({
        displayName,
        lastActive: sql`now()`,
      })
      .where(eq(participants.id, participantId));
  }

  // Response methods
  async createResponse(response: InsertResponse): Promise<Response> {
    const result = await db
      .insert(responses)
      .values({
        participantId: response.participantId,
        slideId: response.slideId,
        answerJson: response.answerJson,
        synced: response.synced || true,
      })
      .returning();
    return result[0];
  }

  async getResponsesByParticipantId(
    participantId: string,
  ): Promise<(Response & { package_wine_id: string })[]> {
    const results = await db
      .select(
        {
          response: responses,
          packageWineId: slides.packageWineId
        }
      )
      .from(responses)
      .leftJoin(slides, eq(responses.slideId, slides.id))
      .where(eq(responses.participantId, participantId));

    return results.map(result => ({
      ...result.response,
      package_wine_id: result.packageWineId || ''
    }));
  }

  async getResponsesBySlideId(slideId: string): Promise<Response[]> {
    return await db
      .select()
      .from(responses)
      .where(eq(responses.slideId, slideId));
  }

  async updateResponse(
    participantId: string,
    slideId: string,
    answerJson: any,
  ): Promise<Response> {
    // First check if participant exists
    const participant = await this.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Use upsert with ON CONFLICT to handle race conditions
    const result = await db
      .insert(responses)
      .values({
        participantId,
        slideId,
        answerJson,
        synced: true,
      })
      .onConflictDoUpdate({
        target: [responses.participantId, responses.slideId],
        set: {
          answerJson,
          answeredAt: sql`now()`,
        },
      })
      .returning();

    return result[0];
  }

  // Analytics method
  async getAggregatedSessionAnalytics(sessionId: string): Promise<any> {
    // 1. Fetch session details and validate existence
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // 2. Get package details for the session
    const packageData = await db
      .select()
      .from(packages)
      .where(eq(packages.id, session.packageId!))
      .limit(1);

    // 3. Fetch all participants for this session
    const sessionParticipants =
      await this.getParticipantsBySessionId(sessionId);

    // 4. Fetch all package wines and their slides for this package (optimized)
    const packageWines = await this.getPackageWines(session.packageId!);
    const wineIds = packageWines.map(w => w.id);

    // Get all slides for all wines in one query
    const sessionSlides = wineIds.length > 0
      ? await db
          .select()
          .from(slides)
          .where(inArray(slides.packageWineId, wineIds))
          .orderBy(slides.globalPosition)
      : [];

    // 5. Fetch all responses for all participants in this session (optimized single query)
    const participantIds = sessionParticipants
      .map((p) => p.id)
      .filter((id) => id !== null);
    const sessionResponses =
      participantIds.length > 0
        ? await db
            .select()
            .from(responses)
            .where(inArray(responses.participantId, participantIds))
        : [];

    // Calculate overall session statistics
    const totalParticipants = sessionParticipants.length;
    const questionSlides = sessionSlides.filter(
      (slide) => slide.type === "question",
    );
    const totalQuestions = questionSlides.length;

    const completedParticipants = sessionParticipants.filter(
      (participant) => (participant.progressPtr || 0) >= totalQuestions,
    ).length;

    const averageProgressPercent =
      totalParticipants > 0
        ? Math.round(
            (sessionParticipants.reduce(
              (sum, p) => sum + (p.progressPtr || 0),
              0,
            ) /
              totalParticipants /
              totalQuestions) *
              100,
          )
        : 0;

    // Process slide-by-slide analytics
    const slidesAnalytics = [];

    for (const slide of questionSlides) {
      const slideResponses = sessionResponses.filter(
        (response) => response.slideId === slide.id,
      );
      const slidePayload = slide.payloadJson as any;

      let aggregatedData: any = {};

      if (slidePayload.question_type === "multiple_choice") {
        // Process multiple choice questions
        const optionsSummary = [];
        const options = slidePayload.options || [];

        for (const option of options) {
          let count = 0;

          for (const response of slideResponses) {
            const answerData = response.answerJson as any;
            if (answerData && answerData.selected) {
              if (Array.isArray(answerData.selected)) {
                if (answerData.selected.includes(option.id)) {
                  count++;
                }
              } else if (answerData.selected === option.id) {
                count++;
              }
            }
          }

          const percentage =
            slideResponses.length > 0
              ? Math.round((count / slideResponses.length) * 100)
              : 0;

          optionsSummary.push({
            optionId: option.id,
            optionText: option.text,
            count,
            percentage,
          });
        }

        // Count notes if allowed
        let notesSubmittedCount = 0;
        if (slidePayload.allow_notes) {
          notesSubmittedCount = slideResponses.filter((response) => {
            const answerData = response.answerJson as any;
            return (
              answerData &&
              answerData.notes &&
              answerData.notes.trim().length > 0
            );
          }).length;
        }

        aggregatedData = {
          optionsSummary,
          notesSubmittedCount,
        };
      } else if (slidePayload.question_type === "scale") {
        // Process scale questions with validation
        const scaleMin = slidePayload.scale_min || slidePayload.min_value || 1;
        const scaleMax = slidePayload.scale_max || slidePayload.max_value || 10;

        const scores = slideResponses
          .map((response) => {
            const answerData = response.answerJson as any;
            let rawValue: number | null = null;

            // Extract numeric value from different answer formats
            if (typeof answerData === "number") {
              rawValue = answerData;
            } else if (typeof answerData === "object" && answerData !== null && typeof answerData.value === "number") {
              rawValue = answerData.value;
            }

            // Validate and clamp the value to scale bounds
            if (rawValue !== null) {
              const clampedValue = Math.max(scaleMin, Math.min(scaleMax, rawValue));

              // Log if we had to clamp the value (indicates data corruption)
              if (clampedValue !== rawValue) {
                console.warn(`🔧 Analytics: Scale value clamped from ${rawValue} to ${clampedValue} (scale: ${scaleMin}-${scaleMax})`);
              }

              return clampedValue;
            }

            return null;
          })
          .filter((score): score is number => score !== null);

        if (scores.length > 0) {
          const averageScore =
            Math.round(
              (scores.reduce((sum, score) => sum + score, 0) / scores.length) *
                10,
            ) / 10;
          const minScore = Math.min(...scores);
          const maxScore = Math.max(...scores);

          // Create score distribution
          const scoreDistribution: { [key: string]: number } = {};
          for (const score of scores) {
            scoreDistribution[score.toString()] =
              (scoreDistribution[score.toString()] || 0) + 1;
          }

          aggregatedData = {
            averageScore,
            minScore,
            maxScore,
            scoreDistribution,
            totalResponses: scores.length,
          };
        } else {
          aggregatedData = {
            averageScore: 0,
            minScore: 0,
            maxScore: 0,
            scoreDistribution: {},
            totalResponses: 0,
          };
        }
      }

      slidesAnalytics.push({
        slideId: slide.id,
        slidePosition: slide.position,
        slideTitle: slidePayload.title || "Untitled Question",
        slideType: slide.type,
        questionType: slidePayload.question_type,
        totalResponses: slideResponses.length,
        aggregatedData,
      });
    }

    return {
      sessionId: session.id,
      sessionName: `Session ${session.id.substring(0, 8)}`, // Generate a session name
      packageName: packageData[0]?.name || "Unknown Package",
      packageCode: session.packageCode || "UNKNOWN",
      totalParticipants,
      completedParticipants,
      averageProgressPercent,
      totalQuestions,
      slidesAnalytics,
    };
  }

  // Participant-specific analytics for enhanced completion experience
  async getParticipantAnalytics(sessionId: string, participantId: string): Promise<any> {
    // 1. Validate session and participant existence
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const participant = await this.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // CRITICAL FIX: Compare against resolved session.id, not input sessionId
    if (participant.sessionId !== session.id) {
      throw new Error("Participant not found");
    }

    // 2. Get aggregated session data for group comparisons
    const sessionAnalytics = await this.getAggregatedSessionAnalytics(session.id);

    // 3. Get participant's individual responses
    const participantResponses = await this.getResponsesByParticipantId(participantId);

    // 4. Get package and wine data
    const packageWines = await this.getPackageWines(session.packageId!);
    // Fetch all slides for all wines in a single query (optimized)
    const wineIds = packageWines.map(w => w.id);
    const allSlides: Slide[] = wineIds.length > 0
      ? await db
          .select()
          .from(slides)
          .where(inArray(slides.packageWineId, wineIds))
          .orderBy(slides.globalPosition)
      : [];

    const questionSlides = allSlides.filter(slide => slide.type === "question");

    // 5. Calculate participant-specific metrics
    const personalSummary = {
      questionsAnswered: participantResponses.length,
      completionPercentage: Math.round((participantResponses.length / questionSlides.length) * 100),
      winesExplored: packageWines.length,
      notesWritten: participantResponses.filter(r => {
        const answer = r.answerJson as any;
        return answer && answer.notes && answer.notes.trim().length > 0;
      }).length,
      sessionDuration: participant.lastActive && session.startedAt
        ? Math.round((new Date(participant.lastActive).getTime() - new Date(session.startedAt).getTime()) / 60000)
        : 0
    };

    // 6. Generate wine-by-wine breakdown with comparisons
    const wineBreakdowns = packageWines.map(wine => {
      const wineSlides = allSlides.filter(slide => slide.packageWineId === wine.id && slide.type === "question");
      const wineResponses = participantResponses.filter(response =>
        wineSlides.some(slide => slide.id === response.slideId)
      );

      const questionAnalysis = wineSlides.map(slide => {
        const participantResponse = participantResponses.find(r => r.slideId === slide.id);
        const slideAnalytics = sessionAnalytics.slidesAnalytics.find((s: any) => s.slideId === slide.id);
        const slidePayload = slide.payloadJson as any;

        let comparison = null;

        // Always create a comparison object if user has answered, even without group data
        if (participantResponse) {
          if (slidePayload.question_type === "scale") {
            const userAnswer = typeof participantResponse.answerJson === "number"
              ? participantResponse.answerJson
              : (participantResponse.answerJson as any)?.value || 0;

            if (slideAnalytics && slideAnalytics.aggregatedData.averageScore !== undefined) {
              // Group data available - calculate comparison
              const groupAverage = slideAnalytics.aggregatedData.averageScore;
              const difference = Math.abs(userAnswer - groupAverage);

              // More nuanced alignment calculation
              let alignment: string;
              let alignmentLevel: string;
              if (difference === 0) {
                alignment = "perfect";
                alignmentLevel = "Perfectly Aligned";
              } else if (difference <= 1) {
                alignment = "close";
                alignmentLevel = "Closely Aligned";
              } else if (difference <= 2) {
                alignment = "somewhat";
                alignmentLevel = "Somewhat Aligned";
              } else if (difference <= 4) {
                alignment = "different";
                alignmentLevel = "Different";
              } else {
                alignment = "unique";
                alignmentLevel = "Unique Perspective";
              }

              comparison = {
                yourAnswer: userAnswer,
                groupAverage: groupAverage,
                differenceFromGroup: userAnswer - groupAverage,
                alignment: alignment,
                alignmentLevel: alignmentLevel,
                percentageMatch: Math.max(0, 100 - (difference * 10)), // 0-100% match score
                hasGroupData: true
              };
            } else {
              // No group data - show skeleton with user's answer only
              comparison = {
                yourAnswer: userAnswer,
                groupAverage: null,
                differenceFromGroup: null,
                alignment: "no_data",
                alignmentLevel: "No Group Data Yet",
                percentageMatch: null,
                hasGroupData: false
              };
            }
          } else if (slidePayload.question_type === "multiple_choice") {
            const userSelections = (participantResponse.answerJson as any)?.selected || [];
            const userSelectionsArray = Array.isArray(userSelections) ? userSelections : [userSelections];
            const optionsSummary = slideAnalytics?.aggregatedData?.optionsSummary || [];

            if (optionsSummary.length === 0 || !slideAnalytics) {
              // No group data - show skeleton with user's answer only
              // Get option text from slide payload
              const options = slidePayload.options || [];
              const userAnswerTexts = userSelectionsArray.map((id: string) => {
                const option = options.find((opt: any) => opt.id === id);
                return option?.text || id;
              });

              comparison = {
                yourAnswer: userSelectionsArray,
                yourAnswerText: userAnswerTexts,
                mostPopular: "No group data yet",
                mostPopularPercentage: 0,
                alignment: "no_data",
                alignmentLevel: "No Group Data Yet",
                consensusScore: 0,
                hasGroupData: false
              };
            } else {
              // Sort options by popularity
              const sortedOptions = optionsSummary.sort((a: any, b: any) => b.percentage - a.percentage);
              const topTwoOptions = sortedOptions.slice(0, 2);
              const top50PercentOptions = sortedOptions.filter((opt: any) => opt.percentage >= 10); // At least 10% popularity

              // Calculate alignment score
              let matchedPopularChoices = 0;
              let totalPopularityMatched = 0;

              userSelectionsArray.forEach((userChoice: string) => {
                const matchedOption = sortedOptions.find((opt: any) => opt.optionId === userChoice);
                if (matchedOption) {
                  totalPopularityMatched += matchedOption.percentage;
                  if (topTwoOptions.find((opt: any) => opt.optionId === userChoice)) {
                    matchedPopularChoices++;
                  }
                }
              });

              // Determine alignment level
              let alignment: string;
              let alignmentLevel: string;

              if (matchedPopularChoices >= 2) {
                alignment = "strong_consensus";
                alignmentLevel = "Strong Consensus";
              } else if (userSelectionsArray.includes(sortedOptions[0]?.optionId)) {
                alignment = "agrees";
                alignmentLevel = "Aligned";
              } else if (userSelectionsArray.some((choice: string) =>
                top50PercentOptions.find((opt: any) => opt.optionId === choice))) {
                alignment = "partial";
                alignmentLevel = "Partial Alignment";
              } else {
                alignment = "unique";
                alignmentLevel = "Unique Taste";
              }

              comparison = {
                yourAnswer: userSelectionsArray,
                mostPopular: sortedOptions[0]?.optionText || "N/A",
                mostPopularPercentage: sortedOptions[0]?.percentage || 0,
                alignment: alignment,
                alignmentLevel: alignmentLevel,
                consensusScore: Math.round(totalPopularityMatched), // Total % popularity of user's choices
                matchedPopularChoices: matchedPopularChoices,
                hasGroupData: true
              };
            }
          }
        }

        return {
          question: slidePayload.title || "Question",
          questionType: slidePayload.question_type,
          answered: !!participantResponse,
          comparison,
          insight: this.generateQuestionInsight(comparison, slidePayload)
        };
      });

      return {
        wineId: wine.id,
        wineName: wine.wineName,
        wineDescription: wine.wineDescription,
        wineImageUrl: wine.wineImageUrl,
        wineType: wine.wineType,
        region: wine.region,
        grapeVarietals: wine.grapeVarietals,
        expectedCharacteristics: wine.expectedCharacteristics,
        questionsAnswered: wineResponses.length,
        totalQuestions: wineSlides.length,
        questionAnalysis
      };
    });

    // 7. Generate tasting personality based on answer patterns
    const tastingPersonality = this.generateTastingPersonality(participantResponses, questionSlides);

    // 8. Calculate achievements
    const achievements = this.calculateAchievements(participantResponses, questionSlides, sessionAnalytics);

    // 9. Generate insights and recommendations
    const insights = this.generatePersonalInsights(participantResponses, sessionAnalytics, wineBreakdowns);

    return {
      participantId,
      sessionId,
      personalSummary,
      wineBreakdowns,
      tastingPersonality,
      achievements,
      insights,
      recommendations: this.generateWineRecommendations(tastingPersonality, participantResponses)
    };
  }

  // Helper method to generate question-specific insights
  private generateQuestionInsight(comparison: any, slidePayload: any): string {
    if (!comparison) return "No comparison data available";

    if (slidePayload.question_type === "scale") {
      const diff = Math.abs(comparison.differenceFromGroup);
      if (diff <= 0.5) return "You aligned closely with the group average";
      if (diff <= 1.5) return comparison.differenceFromGroup > 0
        ? "You rated this higher than most"
        : "You rated this lower than most";
      return comparison.differenceFromGroup > 0
        ? "You detected much stronger intensity than others"
        : "You found this more subtle than most participants";
    }

    if (slidePayload.question_type === "multiple_choice") {
      return comparison.alignment === "agrees"
        ? "You agreed with the majority choice"
        : "You had a unique perspective compared to others";
    }

    return "Response recorded";
  }

  // Helper method to generate tasting personality
  private generateTastingPersonality(responses: Response[], slides: Slide[]): any {
    // Analyze answer patterns to determine personality type
    const scaleResponses = responses.filter(r => {
      const slide = slides.find(s => s.id === r.slideId);
      return slide && (slide.payloadJson as any).question_type === "scale";
    });

    if (scaleResponses.length === 0) {
      return {
        type: "Emerging Taster",
        description: "Just beginning your wine journey",
        characteristics: ["Open to learning", "Developing palate"]
      };
    }

    const averageRating = scaleResponses.reduce((sum, r) => {
      let rawValue = typeof r.answerJson === "number" ? r.answerJson : (r.answerJson as any)?.value || 5;

      // Validate and clamp scale values to expected range (1-10)
      const clampedValue = Math.max(1, Math.min(10, rawValue));

      // Log if we had to clamp the value (indicates data corruption)
      if (clampedValue !== rawValue) {
        console.warn(`🔧 Personality: Scale value clamped from ${rawValue} to ${clampedValue}`);
      }

      return sum + clampedValue;
    }, 0) / scaleResponses.length;

    const hasNotes = responses.some(r => (r.answerJson as any)?.notes?.trim().length > 0);

    if (averageRating >= 7.5) {
      return {
        type: "Bold Explorer",
        description: "You appreciate intense, full-bodied wines with strong characteristics",
        characteristics: ["Seeks bold flavors", "Appreciates intensity", "Confident palate"]
      };
    } else if (averageRating <= 4.5) {
      return {
        type: "Subtle Sophisticate",
        description: "You prefer elegant, nuanced wines with delicate complexity",
        characteristics: ["Values subtlety", "Appreciates nuance", "Refined taste"]
      };
    } else if (hasNotes) {
      return {
        type: "Detail Detective",
        description: "You pay close attention to wine characteristics and love to analyze",
        characteristics: ["Analytical approach", "Detailed observations", "Thorough taster"]
      };
    } else {
      return {
        type: "Balanced Appreciator",
        description: "You enjoy a wide range of wine styles with balanced preferences",
        characteristics: ["Open-minded", "Balanced palate", "Versatile preferences"]
      };
    }
  }

  // Helper method to calculate achievements
  private calculateAchievements(responses: Response[], slides: Slide[], sessionAnalytics: any): any[] {
    const achievements = [];

    // Completion achievements
    if (responses.length === slides.length) {
      achievements.push({
        id: "perfect_completion",
        name: "Perfect Completion",
        description: "Answered every question in the tasting",
        icon: "🎯",
        rarity: "common"
      });
    }

    // Notes achievement
    const notesCount = responses.filter(r => (r.answerJson as any)?.notes?.trim().length > 0).length;
    if (notesCount >= 3) {
      achievements.push({
        id: "detailed_notes",
        name: "Detail Master",
        description: "Added personal notes to multiple questions",
        icon: "📝",
        rarity: "rare"
      });
    }

    // Accuracy achievements (would need expert answer comparison)
    // For now, placeholder logic based on group alignment
    const scaleResponses = responses.filter(r => {
      const slide = slides.find(s => s.id === r.slideId);
      return slide && (slide.payloadJson as any).question_type === "scale";
    });

    let alignmentCount = 0;
    scaleResponses.forEach(response => {
      const slideAnalytics = sessionAnalytics.slidesAnalytics.find((s: any) => s.slideId === response.slideId);
      if (slideAnalytics) {
        let rawUserAnswer = typeof response.answerJson === "number" ? response.answerJson : (response.answerJson as any)?.value || 0;

        // Validate and clamp user answer to expected scale range (1-10)
        const userAnswer = Math.max(1, Math.min(10, rawUserAnswer));

        // Log if we had to clamp the value (indicates data corruption)
        if (userAnswer !== rawUserAnswer) {
          console.warn(`🔧 Achievements: Scale value clamped from ${rawUserAnswer} to ${userAnswer}`);
        }

        const groupAverage = slideAnalytics.aggregatedData.averageScore || 0;
        if (Math.abs(userAnswer - groupAverage) <= 1) {
          alignmentCount++;
        }
      }
    });

    if (alignmentCount >= scaleResponses.length * 0.8) {
      achievements.push({
        id: "group_harmony",
        name: "Consensus Builder",
        description: "Your assessments aligned closely with the group",
        icon: "🤝",
        rarity: "uncommon"
      });
    }

    return achievements;
  }

  // Helper method to generate personal insights
  private generatePersonalInsights(responses: Response[], sessionAnalytics: any, wineBreakdowns: any[]): string[] {
    const insights = [];

    // Tannin sensitivity insight
    const tanninResponses = responses.filter(r => {
      const slideAnalytics = sessionAnalytics.slidesAnalytics.find((s: any) => s.slideId === r.slideId);
      return slideAnalytics && slideAnalytics.slideTitle.toLowerCase().includes("tannin");
    });

    if (tanninResponses.length > 0) {
      const avgTanninRating = tanninResponses.reduce((sum, r) => {
        let rawValue = typeof r.answerJson === "number" ? r.answerJson : (r.answerJson as any)?.value || 5;

        // Validate and clamp tannin values to expected scale (1-10)
        const clampedValue = Math.max(1, Math.min(10, rawValue));

        // Log if we had to clamp the value (indicates data corruption)
        if (clampedValue !== rawValue) {
          console.warn(`🔧 Tannin insight: Scale value clamped from ${rawValue} to ${clampedValue}`);
        }

        return sum + clampedValue;
      }, 0) / tanninResponses.length;

      if (avgTanninRating >= 7) {
        insights.push("You have a keen sensitivity to tannins and appreciate structure in wine");
      } else if (avgTanninRating <= 4) {
        insights.push("You prefer wines with softer, more approachable tannins");
      }
    }

    // Notes quality insight
    const notesCount = responses.filter(r => (r.answerJson as any)?.notes?.trim().length > 0).length;
    if (notesCount >= responses.length * 0.5) {
      insights.push("Your detailed note-taking shows excellent attention to wine characteristics");
    }

    // Consistency insight
    const scaleResponses = responses.filter(r => {
      const slideAnalytics = sessionAnalytics.slidesAnalytics.find((s: any) => s.slideId === r.slideId);
      return slideAnalytics && slideAnalytics.questionType === "scale";
    });

    if (scaleResponses.length >= 3) {
      const values = scaleResponses.map(r => {
        let rawValue = typeof r.answerJson === "number" ? r.answerJson : (r.answerJson as any)?.value || 5;

        // Validate and clamp scale values to expected range (1-10)
        const clampedValue = Math.max(1, Math.min(10, rawValue));

        // Log if we had to clamp the value (indicates data corruption)
        if (clampedValue !== rawValue) {
          console.warn(`🔧 Insights: Scale value clamped from ${rawValue} to ${clampedValue}`);
        }

        return clampedValue;
      });
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;

      if (variance < 2) {
        insights.push("You have a consistent tasting approach across different characteristics");
      } else {
        insights.push("You appreciate diverse wine characteristics and show varied preferences");
      }
    }

    return insights.slice(0, 3); // Return top 3 insights
  }

  // Helper method to generate wine recommendations
  private generateWineRecommendations(personality: any, responses: Response[]): string[] {
    const recommendations = [];

    switch (personality.type) {
      case "Bold Explorer":
        recommendations.push("Try robust Cabernet Sauvignon from Napa Valley");
        recommendations.push("Explore powerful Barolo from Piedmont, Italy");
        recommendations.push("Sample rich Châteauneuf-du-Pape from Rhône Valley");
        break;
      case "Subtle Sophisticate":
        recommendations.push("Discover elegant Pinot Noir from Burgundy");
        recommendations.push("Try delicate Riesling from Mosel, Germany");
        recommendations.push("Explore refined Chablis for mineral complexity");
        break;
      case "Detail Detective":
        recommendations.push("Join a structured wine education course");
        recommendations.push("Try vertical tastings to compare vintages");
        recommendations.push("Explore single-vineyard wines for terroir comparison");
        break;
      default:
        recommendations.push("Continue exploring different wine regions");
        recommendations.push("Try wines from various grape varieties");
        recommendations.push("Join wine tastings to expand your palate");
    }

    return recommendations;
  }

  private async initializeGlossaryTerms() {
    console.log("Initializing wine glossary terms...");

    const wineTerms = [
      // General Wine Terminology
      {
        term: "sommelier",
        variations: ["somm", "wine steward"],
        definition: "A wine steward; a tour guide; or, some lucky schmuck who gets paid to drink and talk about wine.",
        category: "General"
      },
      {
        term: "acidity",
        variations: ["acidic", "crisp", "bright", "zippy"],
        definition: "How much the wine makes your mouth water. High acid = zippy, bright, refreshing. Low acid = smoother, softer. It's about the feeling—and whether you liked it.",
        category: "Structure"
      },
      {
        term: "body",
        variations: ["full-bodied", "medium-bodied", "light-bodied", "weight"],
        definition: "A wine's 'weight' on your palate. Light-bodied wines feel like water or juice; full-bodied wines feel more like whole milk or a smoothie.",
        category: "Structure"
      },
      {
        term: "tannin",
        variations: ["tannins", "tannic"],
        definition: "That drying, grippy sensation in red wines—think about how fuzzy your teeth feel. Light tannins = like thin socks; heavy tannins = thick wool socks. Comes from grape skins, seeds, stems, and oak.",
        category: "Structure"
      },
      {
        term: "primary flavors",
        variations: ["primary notes", "fruit flavors"],
        definition: "The fruit, herbs, and floral notes straight from the grape. Red wines might show cherry, plum, or pepper; whites might show citrus, green apple, or tropical fruit. Fresh and upfront.",
        category: "Flavor"
      },
      {
        term: "secondary flavors",
        variations: ["secondary notes", "winemaking flavors"],
        definition: "Flavors from winemaking (not the grape). Think butter (from malolactic fermentation), yeasty notes (from lees), and oak spices like vanilla, clove, or toast.",
        category: "Flavor"
      },
      {
        term: "tertiary flavors",
        variations: ["tertiary notes", "aged flavors"],
        definition: "Flavors that come with age. Red wines shift to dried fruit, tobacco, and leather; whites to honey, nuts, or Sherry-like qualities. Earthy, savory, and complex.",
        category: "Flavor"
      },
      // Fruit & Flavor Categories
      {
        term: "stone fruit",
        variations: ["stone fruits"],
        definition: "Peach, apricot, nectarine—fleshy fruits with a single pit.",
        category: "Flavor"
      },
      {
        term: "tree fruit",
        variations: ["tree fruits", "orchard fruit"],
        definition: "Apples, pears, quince—crisp, orchard-grown fruits.",
        category: "Flavor"
      },
      {
        term: "citrus fruit",
        variations: ["citrus fruits", "citrus"],
        definition: "Lemon, lime, grapefruit, orange—zesty and bright.",
        category: "Flavor"
      },
      {
        term: "tropical fruit",
        variations: ["tropical fruits"],
        definition: "Pineapple, mango, banana, passionfruit—ripe, exotic, sunshine-y.",
        category: "Flavor"
      },
      {
        term: "minerality",
        variations: ["mineral", "flinty", "chalky", "stony"],
        definition: "A sense of wet stone, chalk, flint, or saline. Not fruity, not spicy—more like licking a rock in the best way.",
        category: "Flavor"
      },
      {
        term: "vessel",
        variations: ["fermentation vessel", "aging vessel"],
        definition: "The container used for fermentation or aging—stainless steel (neutral), oak (adds spice and texture), or amphora/concrete (adds structure or subtle earthiness).",
        category: "Production"
      },
      // Traditional wine terms to maintain compatibility
      {
        term: "finish",
        variations: ["aftertaste", "length"],
        definition: "The lingering flavors and sensations that remain in your mouth after swallowing wine. A long finish is often a sign of quality.",
        category: "Tasting"
      },
      {
        term: "terroir",
        variations: [],
        definition: "The complete natural environment where grapes are grown, including soil, climate, and topography. It's what gives wine its sense of place.",
        category: "Viticulture"
      },
      {
        term: "vintage",
        variations: [],
        definition: "The year the grapes were harvested. Weather conditions during that year significantly impact the wine's character.",
        category: "Production"
      },
      {
        term: "oak",
        variations: ["oaked", "oaky"],
        definition: "Wood used for aging wine, imparting flavors like vanilla, spice, and toast while allowing subtle oxidation that softens the wine.",
        category: "Production"
      },
      {
        term: "bouquet",
        variations: ["nose", "aroma"],
        definition: "The complex scents that develop in wine as it ages, distinct from the primary fruit aromas of young wines.",
        category: "Aroma"
      },
      {
        term: "estate",
        variations: ["château", "domaine"],
        definition: "A winery that controls its own vineyards and winemaking process from grape to bottle, ensuring quality consistency.",
        category: "Production"
      }
    ];

    for (const termData of wineTerms) {
      try {
        await this.createGlossaryTerm(termData);
      } catch (error) {
        // Term might already exist, skip
        console.log(`Glossary term "${termData.term}" already exists or failed to create`);
      }
    }
  }

  async getGlossaryTerms(): Promise<GlossaryTerm[]> {
    return await db.select().from(glossaryTerms).orderBy(glossaryTerms.term);
  }

  async createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm> {
    const result = await db.insert(glossaryTerms).values(term).returning();
    return result[0];
  }

  async getWineCharacteristics(): Promise<any[]> {
    return await db.select().from(wineCharacteristics).where(eq(wineCharacteristics.isActive, true)).orderBy(wineCharacteristics.category, wineCharacteristics.name);
  }

  // Get all responses for a session (for CSV export)
  async getSessionResponses(sessionId: string): Promise<any[]> {
    // Get all responses with participant and slide details
    const allResponses = await db
      .select({
        participantId: responses.participantId,
        participantName: participants.displayName,
        participantEmail: participants.email,
        slideId: responses.slideId,
        slidePayload: slides.payloadJson,
        slidePosition: slides.position,
        answerJson: responses.answerJson,
        answeredAt: responses.answeredAt,
      })
      .from(responses)
      .innerJoin(participants, eq(responses.participantId, participants.id))
      .innerJoin(slides, eq(responses.slideId, slides.id))
      .where(
        and(
          eq(participants.sessionId, sessionId),
          eq(participants.isHost, false) // Exclude host responses
        )
      )
      .orderBy(participants.displayName, slides.position);

    // Process the response data to extract meaningful information
    return allResponses.map((response) => {
      const slidePayload = response.slidePayload as any;
      const answerJson = response.answerJson as any;
      const questionType = slidePayload?.questionType || 'unknown';
      const slideTitle = slidePayload?.title || slidePayload?.question || 'Untitled Question';

      // Extract answer based on question type
      let selectedOptionText = '';
      let scaleValue = null;
      let notes = '';

      if (answerJson) {
        if (questionType === 'multiple_choice' && answerJson.selectedOptionId) {
          const selectedOption = slidePayload?.options?.find((opt: any) => opt.id === answerJson.selectedOptionId);
          selectedOptionText = selectedOption?.text || answerJson.selectedOptionId;
        } else if (questionType === 'scale' && answerJson.selectedScore !== undefined) {
          scaleValue = answerJson.selectedScore;
        }
        notes = answerJson.notes || '';
      }

      return {
        participantName: response.participantName,
        participantEmail: response.participantEmail,
        slideTitle,
        slidePosition: response.slidePosition,
        responseType: questionType,
        selectedOptionText,
        scaleValue,
        notes,
        answeredAt: response.answeredAt,
      };
    });
  }

  // Get completion status for all participants in a session for a specific wine
  async getSessionCompletionStatus(sessionId: string, wineId: string): Promise<any> {
    // 1. Validate session exists and get the actual session UUID
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Use the actual session UUID for subsequent queries
    const actualSessionId = session.id;

    // 2. Get all participants for this session
    const allSessionParticipants = await db
      .select()
      .from(participants)
      .where(eq(participants.sessionId, actualSessionId));

    // Separate host and non-host participants
    const hostParticipants = allSessionParticipants.filter(p => p.isHost);
    const nonHostParticipants = allSessionParticipants.filter(p => !p.isHost);

    // 3. Get all question slides for this specific wine
    const wineQuestionSlides = await db
      .select({
        id: slides.id,
        position: slides.position,
        globalPosition: slides.globalPosition
      })
      .from(slides)
      .where(and(
        eq(slides.packageWineId, wineId),
        eq(slides.type, "question")
      ))
      .orderBy(slides.globalPosition);

    if (wineQuestionSlides.length === 0) {
      return {
        sessionId,
        wineId,
        totalParticipants: allSessionParticipants.length,
        completedParticipants: [],
        pendingParticipants: allSessionParticipants.map((p: any) => ({
          id: p.id,
          displayName: p.displayName,
          email: p.email,
          questionsAnswered: 0,
          totalQuestions: 0
        })),
        allCompleted: false,
        allParticipantsCompleted: false,
        allNonHostParticipantsCompleted: false,
        completedNonHostParticipants: 0,
        totalNonHostParticipants: nonHostParticipants.length,
        completionPercentage: 0
      };
    }

    const slideIds = wineQuestionSlides.map(s => s.id);
    const totalQuestions = wineQuestionSlides.length;

    // 4. Get all responses from all participants for these wine question slides
    const wineResponses = await db
      .select({
        participantId: responses.participantId,
        slideId: responses.slideId
      })
      .from(responses)
      .where(and(
        inArray(responses.participantId, allSessionParticipants.map((p: any) => p.id)),
        inArray(responses.slideId, slideIds)
      ));

    // 5. Calculate completion status for each participant
    const participantCompletionMap = new Map();

    // Initialize all participants with zero responses
    allSessionParticipants.forEach((participant: any) => {
      participantCompletionMap.set(participant.id, {
        id: participant.id,
        displayName: participant.displayName,
        email: participant.email,
        isHost: participant.isHost,
        questionsAnswered: 0,
        totalQuestions,
        completedAt: null
      });
    });

    // Count responses for each participant
    wineResponses.forEach(response => {
      const participantData = participantCompletionMap.get(response.participantId);
      if (participantData) {
        participantData.questionsAnswered += 1;
      }
    });

    // 6. Separate completed and pending participants
    const completedParticipants: any[] = [];
    const pendingParticipants: any[] = [];
    const completedNonHostParticipants: any[] = [];
    const completedHostParticipants: any[] = [];

    participantCompletionMap.forEach(participantData => {
      if (participantData.questionsAnswered >= totalQuestions) {
        completedParticipants.push(participantData);
        if (participantData.isHost) {
          completedHostParticipants.push(participantData);
        } else {
          completedNonHostParticipants.push(participantData);
        }
      } else {
        pendingParticipants.push(participantData);
      }
    });

    // Calculate various completion statuses
    const allParticipantsCompleted = completedParticipants.length === allSessionParticipants.length;
    const allNonHostParticipantsCompleted = completedNonHostParticipants.length === nonHostParticipants.length && nonHostParticipants.length > 0;

    const completionPercentage = allSessionParticipants.length > 0
      ? Math.round((completedParticipants.length / allSessionParticipants.length) * 100)
      : 0;

    return {
      sessionId: actualSessionId,
      originalSessionId: sessionId, // Keep the original input for reference
      wineId,
      totalParticipants: allSessionParticipants.length,
      completedParticipants,
      pendingParticipants,
      allCompleted: allParticipantsCompleted, // Legacy field
      allParticipantsCompleted,
      allNonHostParticipantsCompleted,
      completedNonHostParticipants: completedNonHostParticipants.length,
      totalNonHostParticipants: nonHostParticipants.length,
      completionPercentage,
      wineQuestions: {
        totalQuestions,
        questionSlides: wineQuestionSlides
      }
    };
  }

  // Sentiment analysis methods for Step 3
  async getWineTextResponses(sessionId: string, wineId: string): Promise<any[]> {
    // 1. Get session and validate
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Use the actual session UUID for database queries
    const actualSessionId = session.id;

    // 2. Get all participants for this session (excluding hosts)
    const sessionParticipants = await db
      .select()
      .from(participants)
      .where(and(
        eq(participants.sessionId, actualSessionId),
        eq(participants.isHost, false)
      ));

    if (sessionParticipants.length === 0) {
      return [];
    }

    // 3. Get all text question slides for this wine
    const textQuestionSlides = await db
      .select({
        id: slides.id,
        payloadJson: slides.payloadJson,
        genericQuestions: slides.genericQuestions
      })
      .from(slides)
      .where(and(
        eq(slides.packageWineId, wineId),
        eq(slides.type, "question")
      ));

    // Filter to only text questions
    const textSlides = textQuestionSlides.filter(slide => {
      // Check generic questions format
      if (slide.genericQuestions && typeof slide.genericQuestions === 'object') {
        const genericQ = slide.genericQuestions as any;
        if (genericQ.format === 'text') {
          return true;
        }
      }

      // Check legacy payloadJson format
      const payload = slide.payloadJson as any;
      return payload?.questionType === 'text' ||
             payload?.question_type === 'text' ||
             payload?.questionType === 'free_response' ||
             payload?.question_type === 'free_response';
    });

    if (textSlides.length === 0) {
      return [];
    }

    const textSlideIds = textSlides.map(s => s.id);

    // 4. Get all text responses from participants for these slides
    const textResponses = await db
      .select({
        slideId: responses.slideId,
        participantId: responses.participantId,
        answerJson: responses.answerJson,
        createdAt: responses.answeredAt,
        participant: {
          displayName: participants.displayName,
          email: participants.email
        }
      })
      .from(responses)
      .leftJoin(participants, eq(responses.participantId, participants.id))
      .where(and(
        inArray(responses.participantId, sessionParticipants.map(p => p.id)),
        inArray(responses.slideId, textSlideIds)
      ))
      .orderBy(responses.answeredAt);

    // 5. Format responses for sentiment analysis
    return textResponses.map(response => {
      const slide = textSlides.find(s => s.id === response.slideId);
      let questionText = 'Unknown Question';

      if (slide?.genericQuestions && typeof slide.genericQuestions === 'object') {
        const genericQ = slide.genericQuestions as any;
        if (genericQ.config?.title) {
          questionText = genericQ.config.title;
        }
      } else if (slide?.payloadJson) {
        const payload = slide.payloadJson as any;
        questionText = payload.title || payload.question || 'Unknown Question';
      }

      return {
        slideId: response.slideId,
        participantId: response.participantId,
        participantName: response.participant?.displayName || 'Anonymous',
        questionText,
        answerText: typeof response.answerJson === 'string'
          ? response.answerJson
          : ((response.answerJson as any)?.text || (response.answerJson as any)?.answer || String(response.answerJson || '')),
        timestamp: response.createdAt
      };
    });
  }

  async saveSentimentAnalysis(sessionId: string, wineId: string, results: any[]): Promise<void> {
    // Store sentiment analysis results in memory for this session
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Create a unique key for this session and wine combination
    const key = `${sessionId}-${wineId}`;

    // Extract individual sentiment scores from the results
    const sentimentData: any[] = [];

    results.forEach(result => {
      if (result.textResponses && Array.isArray(result.textResponses)) {
        // Extract each text response with its sentiment score
        result.textResponses.forEach((response: any) => {
          if (response.analysis && response.analysis.sentimentScore) {
            sentimentData.push({
              slideId: response.slideId,
              questionTitle: response.questionTitle,
              textContent: response.textContent,
              sentimentScore: response.analysis.sentimentScore,
              sentiment: response.analysis.sentiment,
              confidence: response.analysis.confidence,
              participantId: result.participantId || 'aggregate'
            });
          }
        });
      }
    });

    // Cap at 200 entries — evict oldest (FIFO via Map insertion order)
    if (this.sentimentAnalysisResults.size >= 200 && !this.sentimentAnalysisResults.has(key)) {
      const oldestKey = this.sentimentAnalysisResults.keys().next().value;
      if (oldestKey !== undefined) {
        this.sentimentAnalysisResults.delete(oldestKey);
      }
    }

    this.sentimentAnalysisResults.set(key, sentimentData);

    console.log(`✅ Saved ${sentimentData.length} sentiment analysis results for wine ${wineId} in session ${sessionId}`);
    console.log('Processed sentiment data:', sentimentData);
  }

  // Step 4: Average calculation methods
  async calculateWineQuestionAverages(sessionId: string, wineId: string): Promise<any[]> {
    // 1. Get session and validate
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Use the actual session UUID for database queries
    const actualSessionId = session.id;

    // 2. Get all participants for this session (excluding hosts)
    const sessionParticipants = await db
      .select()
      .from(participants)
      .where(and(
        eq(participants.sessionId, actualSessionId),
        eq(participants.isHost, false)
      ));

    if (sessionParticipants.length === 0) {
      return [];
    }

    // 3. Get all question slides for this wine
    const wineQuestionSlides = await db
      .select({
        id: slides.id,
        position: slides.position,
        globalPosition: slides.globalPosition,
        type: slides.type,
        payloadJson: slides.payloadJson,
        genericQuestions: slides.genericQuestions
      })
      .from(slides)
      .where(and(
        eq(slides.packageWineId, wineId),
        eq(slides.type, "question"),
        eq(slides.comparable, true),
      ))
      .orderBy(slides.globalPosition);

    if (wineQuestionSlides.length === 0) {
      return [];
    }

    const slideIds = wineQuestionSlides.map(s => s.id);
    const participantIds = sessionParticipants.map(p => p.id);

    // 4. Get all responses for these questions with participant names
    const allResponses = await db
      .select({
        slideId: responses.slideId,
        participantId: responses.participantId,
        answerJson: responses.answerJson,
        answeredAt: responses.answeredAt,
        participantName: participants.displayName
      })
      .from(responses)
      .innerJoin(participants, eq(responses.participantId, participants.id))
      .where(and(
        inArray(responses.slideId, slideIds),
        inArray(responses.participantId, participantIds)
      ));

    // 5. Calculate averages for each question slide
    const questionAverages = [];

    for (const slide of wineQuestionSlides) {
      const slideResponses = allResponses.filter(r => r.slideId === slide.id);

      if (slideResponses.length === 0) {
        // No responses yet
        questionAverages.push({
          slideId: slide.id,
          position: slide.position,
          globalPosition: slide.globalPosition,
          questionType: this.getQuestionType(slide),
          questionTitle: this.getQuestionTitle(slide),
          totalResponses: 0,
          averageScore: null,
          responseDistribution: {},
          timestamp: new Date().toISOString()
        });
        continue;
      }

      const questionType = this.getQuestionType(slide);
      let averageScore: number | null = null;
      let responseDistribution: any = {};

      switch (questionType) {
        case 'scale':
          averageScore = this.calculateScaleAverage(slideResponses);
          responseDistribution = this.getScaleDistribution(slideResponses);
          break;

        case 'multiple_choice':
          responseDistribution = this.getMultipleChoiceDistributionWithUsers(slideResponses, slide);
          averageScore = this.calculateMultipleChoiceScore(responseDistribution);
          break;

        case 'boolean':
          responseDistribution = this.getBooleanDistributionWithUsers(slideResponses);
          averageScore = this.calculateBooleanScore(responseDistribution);
          break;

        case 'text':
          // For text questions, get the summary instead of sentiment scores
          const textSummary = await this.calculateTextSummaryAverage(sessionId, wineId, slide.id);
          averageScore = null; // No numerical score for text questions
          responseDistribution = {
            textResponseCount: slideResponses.length,
            summary: textSummary?.summary || 'No summary available',
            keywords: textSummary?.keywords || [],
            sentiment: textSummary?.sentiment || 'neutral'
          };
          break;

        default:
          // Generic handling for unknown question types
          averageScore = null;
          responseDistribution = { unknownType: slideResponses.length };
      }

      questionAverages.push({
        slideId: slide.id,
        position: slide.position,
        globalPosition: slide.globalPosition,
        questionType,
        questionTitle: this.getQuestionTitle(slide),
        totalResponses: slideResponses.length,
        averageScore,
        responseDistribution,
        timestamp: new Date().toISOString()
      });
    }

    return questionAverages;
  }

  async getComparabelQuestions(sessionId: string, wineId: string): Promise<any[]> {
    // 1. Get session and validate
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Use the actual session UUID for database queries
    const actualSessionId = session.id;

    // 2. Get all question slides for this wine that are comparable
    const comparableSlides = await db
      .select({
        id: slides.id,
        position: slides.position,
        globalPosition: slides.globalPosition,
        type: slides.type,
        payloadJson: slides.payloadJson,
        genericQuestions: slides.genericQuestions
      })
      .from(slides)
      .where(and(
        eq(slides.packageWineId, wineId),
        eq(slides.type, "question"),
        eq(slides.comparable, true)
      ))
      .orderBy(slides.globalPosition);

    return comparableSlides.map(slide => ({
      slideId: slide.id,
      position: slide.position,
      globalPosition: slide.globalPosition,
      questionType: this.getQuestionType(slide),
      questionTitle: this.getQuestionTitle(slide)
    }));
  }

  async updateSlideComparableQuestions(slideId: string){
    // 1. Get the slide by ID
    let slide: any = await db
      .select()
      .from(slides)
      .where(eq(slides.id, slideId))
      .limit(1);

    slide = slide[0]


    if (!slide) {
      throw new Error("Slide not found");
    }

    // 3. Update the comparable field to true
    const response = await db
      .update(slides)
      .set({ comparable: !slide.comparable })
      .where(eq(slides.id, slideId));

    console.log(`✅ Slide ${slideId} marked as comparable `, '\n', response );
    return {
      success: !slide.comparable,
      message: `Slide ${slideId} marked as comparable`
    };
  }


  // Helper methods for Step 4 calculations
  private getQuestionType(slide: any): string {
    // Check genericQuestions first
    if (slide.genericQuestions && typeof slide.genericQuestions === 'object') {
      const genericQ = slide.genericQuestions as any;
      if (genericQ.question_type) return genericQ.question_type;
      if (genericQ.format === 'text') return 'text';
    }

    // Check payloadJson
    if (slide.payloadJson && typeof slide.payloadJson === 'object') {
      const payload = slide.payloadJson as any;
      if (payload.question_type) return payload.question_type;
      if (payload.questionType) return payload.questionType;
    }

    return 'unknown';
  }

  private getQuestionTitle(slide: any): string {
    // Check genericQuestions first
    if (slide.genericQuestions && typeof slide.genericQuestions === 'object') {
      const genericQ = slide.genericQuestions as any;
      if (genericQ.title) return genericQ.title;
      if (genericQ.config?.title) return genericQ.config.title;
    }

    // Check payloadJson
    if (slide.payloadJson && typeof slide.payloadJson === 'object') {
      const payload = slide.payloadJson as any;
      if (payload.title) return payload.title;
      if (payload.question) return payload.question;
    }

    return 'Untitled Question';
  }

  private calculateScaleAverage(responses: any[]): number {
    const validScores = responses
      .map(r => {
        let score: number;
        if (typeof r.answerJson === 'number') {
          score = r.answerJson;
        } else if (r.answerJson && typeof r.answerJson === 'object') {
          const answerObj = r.answerJson as any;
          score = answerObj.value || answerObj.selectedScore || answerObj.score || 0;
        } else {
          score = 0;
        }

        // Clamp to reasonable scale range (1-10)
        return Math.max(1, Math.min(10, score));
      })
      .filter(score => score > 0);

    if (validScores.length === 0) return 0;

    const sum = validScores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / validScores.length) * 100) / 100; // Round to 2 decimal places
  }

  private getScaleDistribution(responses: any[]): {
    distribution: { [score: string]: number };
    minScore: number;
    minUsers: string[];
    maxScore: number;
    maxUsers: string[];
  } {
    const distribution: { [key: string]: number } = {};
    let minScore = 10;
    let maxScore = 1;
    const minUsers: string[] = [];
    const maxUsers: string[] = [];

    responses.forEach(r => {
      let score: number;
      if (typeof r.answerJson === 'number') {
        score = r.answerJson;
      } else if (r.answerJson && typeof r.answerJson === 'object') {
        const answerObj = r.answerJson as any;
        score = answerObj.value || answerObj.selectedScore || answerObj.score || 0;
      } else {
        score = 0;
      }

      // Clamp to reasonable range (1–10)
      score = Math.max(1, Math.min(10, score));
      const scoreKey = score.toString();

      // Build distribution
      distribution[scoreKey] = (distribution[scoreKey] || 0) + 1;

      const user = r.participantName || 'Unknown User';

      // Track min users
      if (score < minScore) {
        minScore = score;
        minUsers.length = 0;
        minUsers.push(user);
      } else if (score === minScore) {
        minUsers.push(user);
      }

      // Track max users
      if (score > maxScore) {
        maxScore = score;
        maxUsers.length = 0;
        maxUsers.push(user);
      } else if (score === maxScore) {
        maxUsers.push(user);
      }
    });

    return {
      distribution,
      minScore,
      minUsers,
      maxScore,
      maxUsers
    };
  }

  private getMultipleChoiceDistribution(responses: any[], slide: any): any {
    const distribution: { [key: string]: { count: number, optionText: string } } = {};

    // First, extract option details from slide configuration
    const optionDetails = this.getOptionDetails(slide);

    responses.forEach(r => {
      if (r.answerJson && typeof r.answerJson === 'object') {
        const answerObj = r.answerJson as any;

        // Handle different multiple choice answer formats
        if (answerObj.selectedOptionId) {
          const optionId = answerObj.selectedOptionId;
          if (!distribution[optionId]) {
            distribution[optionId] = {
              count: 0,
              optionText: optionDetails[optionId] || `Option ${optionId}`
            };
          }
          distribution[optionId].count += 1;
        } else if (answerObj.selectedOptionIds && Array.isArray(answerObj.selectedOptionIds)) {
          // Multi-select
          answerObj.selectedOptionIds.forEach((id: string) => {
            if (!distribution[id]) {
              distribution[id] = {
                count: 0,
                optionText: optionDetails[id] || `Option ${id}`
              };
            }
            distribution[id].count += 1;
          });
        } else if (answerObj.selectedOptions && Array.isArray(answerObj.selectedOptions)) {
          answerObj.selectedOptions.forEach((option: any) => {
            const optionId = option.id || option;
            if (!distribution[optionId]) {
              distribution[optionId] = {
                count: 0,
                optionText: optionDetails[optionId] || `Option ${optionId}`
              };
            }
            distribution[optionId].count += 1;
          });
        } else if (answerObj.selected && Array.isArray(answerObj.selected)) {
          // Handle "selected" array format (e.g., ["1", "2"])
          answerObj.selected.forEach((optionId: string) => {
            if (!distribution[optionId]) {
              distribution[optionId] = {
                count: 0,
                optionText: optionDetails[optionId] || `Option ${optionId}`
              };
            }
            distribution[optionId].count += 1;
          });
        }
      }
    });

    // Convert to array format with option number, text, count, and percentage
    const totalResponses = responses.length;
    const distributionArray = Object.entries(distribution).map(([optionId, data]) => ({
      optionNumber: parseInt(optionId) || optionId, // Convert to number if possible, otherwise keep as string
      optionText: data.optionText,
      count: data.count,
      percentage: totalResponses > 0 ? Math.round((data.count / totalResponses) * 100 * 100) / 100 : 0 // Round to 2 decimal places
    }));

    // Sort by option number/id for consistent ordering
    distributionArray.sort((a, b) => {
      if (typeof a.optionNumber === 'number' && typeof b.optionNumber === 'number') {
        return a.optionNumber - b.optionNumber;
      }
      return String(a.optionNumber).localeCompare(String(b.optionNumber));
    });

    return distributionArray;
  }

  private getMultipleChoiceDistributionWithUsers(responses: any[], slide: any): any {
    const distribution: { [key: string]: { count: number, optionText: string, users: string[] } } = {};

    // First, extract option details from slide configuration
    const optionDetails = this.getOptionDetails(slide);

    responses.forEach(r => {
      if (r.answerJson && typeof r.answerJson === 'object') {
        const answerObj = r.answerJson as any;
        const participantName = r.participantName || 'Unknown User';

        // Handle different multiple choice answer formats
        if (answerObj.selectedOptionId) {
          const optionId = answerObj.selectedOptionId;
          if (!distribution[optionId]) {
            distribution[optionId] = {
              count: 0,
              optionText: optionDetails[optionId] || `Option ${optionId}`,
              users: []
            };
          }
          distribution[optionId].count += 1;
          distribution[optionId].users.push(participantName);
        } else if (answerObj.selectedOptionIds && Array.isArray(answerObj.selectedOptionIds)) {
          // Multi-select
          answerObj.selectedOptionIds.forEach((id: string) => {
            if (!distribution[id]) {
              distribution[id] = {
                count: 0,
                optionText: optionDetails[id] || `Option ${id}`,
                users: []
              };
            }
            distribution[id].count += 1;
            distribution[id].users.push(participantName);
          });
        } else if (answerObj.selectedOptions && Array.isArray(answerObj.selectedOptions)) {
          answerObj.selectedOptions.forEach((option: any) => {
            const optionId = option.id || option;
            if (!distribution[optionId]) {
              distribution[optionId] = {
                count: 0,
                optionText: optionDetails[optionId] || `Option ${optionId}`,
                users: []
              };
            }
            distribution[optionId].count += 1;
            distribution[optionId].users.push(participantName);
          });
        } else if (answerObj.selected && Array.isArray(answerObj.selected)) {
          // Handle "selected" array format (e.g., ["1", "2"])
          answerObj.selected.forEach((optionId: string) => {
            if (!distribution[optionId]) {
              distribution[optionId] = {
                count: 0,
                optionText: optionDetails[optionId] || `Option ${optionId}`,
                users: []
              };
            }
            distribution[optionId].count += 1;
            distribution[optionId].users.push(participantName);
          });
        }
      }
    });

    // Convert to array format with option number, text, count, percentage, and users
    const totalResponses = responses.length;
    const distributionArray = Object.entries(distribution).map(([optionId, data]) => ({
      optionNumber: parseInt(optionId) || optionId, // Convert to number if possible, otherwise keep as string
      optionText: data.optionText,
      count: data.count,
      percentage: totalResponses > 0 ? Math.round((data.count / totalResponses) * 100 * 100) / 100 : 0, // Round to 2 decimal places
      users: data.users
    }));

    // Sort by option number/id for consistent ordering
    distributionArray.sort((a, b) => {
      if (typeof a.optionNumber === 'number' && typeof b.optionNumber === 'number') {
        return a.optionNumber - b.optionNumber;
      }
      return String(a.optionNumber).localeCompare(String(b.optionNumber));
    });

    return distributionArray;
  }

  private getOptionDetails(slide: any): { [key: string]: string } {
    const optionDetails: { [key: string]: string } = {};

    // Check genericQuestions first
    if (slide.genericQuestions && typeof slide.genericQuestions === 'object') {
      const genericQ = slide.genericQuestions as any;
      if (genericQ.options && Array.isArray(genericQ.options)) {
        genericQ.options.forEach((option: any, index: number) => {
          if (typeof option === 'string') {
            optionDetails[index.toString()] = option;
          } else if (option && typeof option === 'object') {
            const id = option.id || option.value || index.toString();
            const text = option.text || option.label || option.title || option.value || `Option ${index + 1}`;
            optionDetails[id] = text;
          }
        });
      }
    }

    // Check payloadJson for options
    if (slide.payloadJson && typeof slide.payloadJson === 'object') {
      const payload = slide.payloadJson as any;
      if (payload.options && Array.isArray(payload.options)) {
        payload.options.forEach((option: any, index: number) => {
          if (typeof option === 'string') {
            optionDetails[index.toString()] = option;
          } else if (option && typeof option === 'object') {
            const id = option.id || option.value || index.toString();
            const text = option.text || option.label || option.title || option.value || `Option ${index + 1}`;
            optionDetails[id] = text;
          }
        });
      }
    }

    return optionDetails;
  }

  private calculateMultipleChoiceScore(distribution: any): number {
    // For multiple choice, calculate the percentage of responses that chose the most popular option
    if (!Array.isArray(distribution) || distribution.length === 0) {
      return 0;
    }

    // Get the highest percentage (most popular option)
    const maxPercentage = Math.max(...distribution.map((option: any) => option.percentage || 0));

    // Return percentage as decimal (0-1) for frontend to display correctly
    return Math.round(maxPercentage) / 100; // Convert percentage back to decimal (0.00-1.00)
  }

  private getBooleanDistribution(responses: any[]): any {
    const distribution: { [key: string]: number } = { true: 0, false: 0 };

    responses.forEach(r => {
      if (r.answerJson && typeof r.answerJson === 'object') {
        const answerObj = r.answerJson as any;
        const value = answerObj.value || answerObj.answer;

        if (typeof value === 'boolean') {
          distribution[value.toString()] += 1;
        } else if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'yes' || lowerValue === 'false') {
            distribution.true += 1;
          } else if (lowerValue === 'no' || lowerValue === 'false') {
            distribution.false += 1;
          }
        }
      }
    });

    return distribution;
  }

  private getBooleanDistributionWithUsers(responses: any[]): any {
    const distribution: { [key: string]: { count: number, users: string[] } } = { true: { count: 0, users: [] }, false: { count: 0, users: [] } };

    // Helper to coerce various shapes into a boolean
    const coerceBool = (input: any): boolean | null => {
      if (typeof input === 'boolean') return input;
      if (typeof input === 'number') return input > 0;
      if (typeof input === 'string') {
        const s = input.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'on'].includes(s)) return true;
        if (['false', 'no', 'n', '0', 'off'].includes(s)) return false;
        return null;
      }
      if (input && typeof input === 'object') {
        // Common fields
        const candidates = [
          (input as any).value,
          (input as any).answer,
          (input as any).selected,
          (input as any).checked,
          (input as any).option,
          (input as any).choice,
          (input as any).selectedOption,
          (input as any).optionValue,
        ];
        for (const c of candidates) {
          const v = coerceBool(c);
          if (v !== null) return v;
        }
        // Nested patterns e.g., { selected: { value: true } }
        if ((input as any).selected && typeof (input as any).selected === 'object') {
          const v = coerceBool((input as any).selected.value ?? (input as any).selected.option);
          if (v !== null) return v;
        }
        // Option text fallbacks
        const t = (input as any).optionText;
        const v2 = coerceBool(t);
        if (v2 !== null) return v2;
      }
      return null;
    };

    let recognized = 0;
    responses.forEach(r => {
      const participantName = r.participantName || 'Unknown User';
      const ans = r.answerJson;
      const val = coerceBool(ans);
      if (val === null) return;
      recognized += 1;
      distribution[val.toString()].count += 1;
      distribution[val.toString()].users.push(participantName);
    });

    // Convert to array format with count, percentage, and users
    const totalForPct = recognized > 0 ? recognized : responses.length;
    return [
      {
        option: 'true',
        optionText: 'Yes',
        count: distribution.true.count,
        percentage: totalForPct > 0 ? Math.round((distribution.true.count / totalForPct) * 100) : 0,
        users: distribution.true.users
      },
      {
        option: 'false',
        optionText: 'No',
        count: distribution.false.count,
        percentage: totalForPct > 0 ? Math.round((distribution.false.count / totalForPct) * 100) : 0,
        users: distribution.false.users
      }
    ];
  }

  private calculateBooleanScore(distribution: any): number {
    const total = distribution.true + distribution.false;
    if (total === 0) return 0;

    // Return percentage of "true" responses (0-10 scale)
    const truePercentage = distribution.true / total;
    return Math.round(truePercentage * 10 * 100) / 100;
  }

  async calculateTextSummaryAverage(sessionId: string, wineId: string, slideId: string): Promise<{ summary: string; keywords: string[]; sentiment: string } | null> {
    try {
      // Get all text responses for this specific slide
      const textResponses = await this.getWineTextResponses(sessionId, wineId);
      const slideTextResponses = textResponses.filter(response => response.slideId === slideId);

      if (slideTextResponses.length === 0) {
        console.log(`📊 No text responses available for slide ${slideId} in wine ${wineId}`);
        return null;
      }

      // Import the summary analysis function
      const { analyzeWineTextResponsesForSummary } = await import('./openai-client.js');

      // Format responses for analysis
      const formattedResponses = slideTextResponses.map(response => ({
        slideId: response.slideId,
        questionTitle: response.questionText || 'Wine question',
        textContent: response.answerText
      }));

      // Get summary analysis
      const analysisResult = await analyzeWineTextResponsesForSummary(formattedResponses, wineId, sessionId);

      if (analysisResult.textResponses.length > 0) {
        const slideAnalysis = analysisResult.textResponses.find(resp => resp.slideId === slideId);
        if (slideAnalysis) {
          console.log(`📊 Generated text summary for slide ${slideId}: ${slideAnalysis.analysis.summary?.substring(0, 100)}...`);
          return {
            summary: slideAnalysis.analysis.summary || 'Summary not available',
            keywords: slideAnalysis.analysis.keywords || [],
            sentiment: slideAnalysis.analysis.sentiment || 'neutral'
          };
        }
      }

      // Fallback to overall sentiment if slide-specific analysis not found
      return {
        summary: analysisResult.overallSentiment.summary || 'Summary not available',
        keywords: analysisResult.overallSentiment.keywords || [],
        sentiment: analysisResult.overallSentiment.sentiment || 'neutral'
      };

    } catch (error) {
      console.error(`📊 Error calculating text summary for slide ${slideId}:`, error);
      return null;
    }
  }

  async calculateTextSentimentAverage(sessionId: string, wineId: string, slideId: string): Promise<number | null> {
    // Get sentiment analysis results for this session and wine
    const key = `${sessionId}-${wineId}`;
    const sentimentResults = this.sentimentAnalysisResults.get(key);

    if (!sentimentResults || sentimentResults.length === 0) {
      console.log(`📊 No sentiment analysis results available for slide ${slideId} in wine ${wineId}`);
      return null;
    }

    // Filter results for this specific slide and calculate average sentiment score
    const slideResults = sentimentResults.filter(result => result.slideId === slideId);

    if (slideResults.length === 0) {
      console.log(`📊 No sentiment analysis results for slide ${slideId}`);
      return null;
    }

    // Calculate average sentiment score (1-10 scale)
    const sentimentScores = slideResults.map(result => result.sentimentScore).filter(score => score !== null && score !== undefined);

    if (sentimentScores.length === 0) {
      console.log(`📊 No valid sentiment scores for slide ${slideId}`);
      return null;
    }

    const average = sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length;
    console.log(`📊 Calculated sentiment average ${average.toFixed(2)} for slide ${slideId} (${sentimentScores.length} responses)`);

    return Math.round(average * 100) / 100; // Round to 2 decimal places
  }

  // Package management methods for sommelier dashboard
  async getAllPackages(): Promise<Package[]> {
    const packagesData = await db.select().from(packages).orderBy(packages.createdAt);
    if (packagesData.length === 0) return [];

    // Bulk fetch all wines for all packages (2 queries instead of N+1)
    const packageIds = packagesData.map(p => p.id);
    const allWines = await db.select().from(packageWines)
      .where(inArray(packageWines.packageId, packageIds))
      .orderBy(packageWines.position);

    return packagesData.map(pkg => ({
      ...pkg,
      wines: allWines.filter(wine => wine.packageId === pkg.id),
    }));
  }

  async updatePackage(id: string, data: Partial<InsertPackage>): Promise<Package> {
    const [updatedPackage] = await db
      .update(packages)
      .set(data)
      .where(eq(packages.id, id))
      .returning();
    return updatedPackage;
  }

  async deletePackage(id: string): Promise<void> {
    await db.delete(packages).where(eq(packages.id, id));
  }

  async getAllSessions(): Promise<Session[]> {
    // Single query with correlated subquery for participant count (1 query instead of N+1)
    const result = await db
      .select({
        id: sessions.id,
        packageId: sessions.packageId,
        short_code: sessions.short_code,
        status: sessions.status,
        startedAt: sessions.startedAt,
        completedAt: sessions.completedAt,
        activeParticipants: sessions.activeParticipants,
        updatedAt: sessions.updatedAt,
        // Include package information
        packageName: packages.name,
        packageCode: packages.code,
        // Participant count via correlated subquery
        participantCount: sql<number>`(SELECT count(*)::int FROM participants WHERE participants.session_id = ${sessions.id})`,
      })
      .from(sessions)
      .leftJoin(packages, eq(sessions.packageId, packages.id))
      .orderBy(desc(sessions.updatedAt)); // Most recent first

    return result as any;
  }

  // Wine management methods for sommelier dashboard
  private getDefaultSlideTemplates() {
    return [
      {
        position: 1,
        type: "interlude" as const,
        section_type: "intro" as const,
        payloadJson: {
          title: "Welcome to Your Wine Tasting",
          description: "Let's begin our journey through this exceptional wine",
        },
      },
      {
        position: 2,
        type: "question" as const,
        section_type: "intro" as const,
        payloadJson: {
          title: "What aromas do you detect?",
          description: "Take a moment to swirl and smell. Select all the aromas you can identify.",
          question_type: "multiple_choice",
          category: "Aroma",
          options: [
            {
              id: "1",
              text: "Dark fruits (blackberry, plum)",
              description: "Rich, concentrated berry aromas",
            },
            {
              id: "2",
              text: "Vanilla and oak",
              description: "From barrel aging",
            },
            {
              id: "3",
              text: "Spices (pepper, clove)",
              description: "Complex spice notes",
            },
            {
              id: "4",
              text: "Floral notes",
              description: "Violet or rose petals",
            },
            {
              id: "5",
              text: "Earth and minerals",
              description: "Terroir characteristics",
            },
          ],
          allow_multiple: true,
          allow_notes: true,
        },
      },
      {
        position: 3,
        type: "question" as const,
        section_type: "deep_dive" as const,
        payloadJson: {
          title: "Rate the aroma intensity",
          description: "How strong are the aromas? 1 = Very light, 10 = Very intense",
          question_type: "scale",
          category: "Intensity",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Very Light", "Very Intense"],
          backgroundImage: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600&h=400&fit=crop",
        },
      },
      {
        position: 4,
        type: "question" as const,
        section_type: "deep_dive" as const,
        payloadJson: {
          title: "Describe the taste profile",
          description: "Take a sip and identify the flavors you experience.",
          question_type: "multiple_choice",
          category: "Taste",
          backgroundImage: "https://images.unsplash.com/photo-1574982817-a0138501b8e7?w=600&h=400&fit=crop",
          options: [
            {
              id: "1",
              text: "Red fruits (cherry, raspberry)",
              description: "Bright fruit flavors",
            },
            {
              id: "2",
              text: "Dark fruits (blackcurrant, plum)",
              description: "Rich, deep fruit flavors",
            },
            {
              id: "3",
              text: "Chocolate and coffee",
              description: "Rich, roasted notes",
            },
            {
              id: "4",
              text: "Tobacco and leather",
              description: "Aged, complex flavors",
            },
            {
              id: "5",
              text: "Herbs and spices",
              description: "Savory elements",
            },
          ],
          allow_multiple: true,
          allow_notes: true,
        },
      },
      {
        position: 5,
        type: "question" as const,
        section_type: "deep_dive" as const,
        payloadJson: {
          title: "How would you describe the body?",
          description: "The weight and fullness of the wine in your mouth",
          question_type: "scale",
          category: "Body",
          scale_min: 1,
          scale_max: 5,
          scale_labels: ["Light Body", "Full Body"],
        },
      },
      {
        position: 6,
        type: "question" as const,
        section_type: "deep_dive" as const,
        payloadJson: {
          title: "Tannin level assessment",
          description: "How much dryness and grip do you feel on your gums and tongue?",
          question_type: "scale",
          category: "Tannins",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Soft Tannins", "Firm Tannins"],
        },
      },
      {
        position: 7,
        type: "question" as const,
        section_type: "ending" as const,
        payloadJson: {
          title: "How long is the finish?",
          description: "How long do the flavors linger after swallowing?",
          question_type: "scale",
          category: "Finish",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Short Finish", "Very Long Finish"],
        },
      },
      {
        position: 8,
        type: "question" as const,
        section_type: "ending" as const,
        payloadJson: {
          title: "Overall wine rating",
          description: "Your overall impression of this wine",
          question_type: "scale",
          category: "Overall",
          scale_min: 1,
          scale_max: 10,
          scale_labels: ["Poor", "Excellent"],
        },
      },
    ];
  }

  async createPackageWineFromDashboard(wine: InsertPackageWine): Promise<PackageWine> {
    // Get the next position for this package (read outside transaction is safe)
    const existingWines = await this.getPackageWines(wine.packageId);
    const nextPosition = existingWines.length + 1;

    const wineData = {
      ...wine,
      position: nextPosition,
      wineType: wine.wineType || 'red',
      vintage: wine.vintage || new Date().getFullYear() - 2,
      region: wine.region || 'Napa Valley',
      producer: wine.producer || 'Premium Winery',
      grapeVarietals: wine.grapeVarietals || ['Cabernet Sauvignon'],
      alcoholContent: wine.alcoholContent || '14.5%',
      expectedCharacteristics: wine.expectedCharacteristics || {
        aroma: ['Dark fruits', 'Oak', 'Vanilla'],
        taste: ['Bold', 'Full-bodied', 'Smooth tannins'],
        color: 'Deep ruby red',
        finish: 'Long and elegant'
      },
      discussionQuestions: wine.discussionQuestions || []
    };

    // Use transaction to ensure wine and all slides are created atomically
    return db.transaction(async (tx) => {
      const [newWine] = await tx.insert(packageWines).values(wineData).returning();

      // Calculate global position base for this wine
      const wineBasePosition = newWine.position * 1000;

      // Helper to calculate global position for a slide
      const calculateGlobalPosition = (sectionType: string, isWineIntro: boolean, localPosition: number): number => {
        let sectionOffset = 0;
        if (sectionType === 'intro') {
          sectionOffset = isWineIntro ? 10 : 50;
        } else if (sectionType === 'deep_dive' || sectionType === 'tasting') {
          sectionOffset = 100;
        } else if (sectionType === 'ending' || sectionType === 'conclusion') {
          sectionOffset = 200;
        }
        // Add local position offset within section (10 per slide)
        return wineBasePosition + sectionOffset + (localPosition * 10);
      };

      // Create wine introduction slide with wine-specific information
      await tx.insert(slides).values({
        packageWineId: newWine.id,
        position: 1,
        globalPosition: calculateGlobalPosition('intro', true, 0),
        type: "interlude",
        section_type: "intro",
        payloadJson: {
          title: `Meet ${newWine.wineName}`,
          description: newWine.wineDescription || `Discover the unique characteristics of this exceptional wine.`,
          wine_name: newWine.wineName,
          wine_image: newWine.wineImageUrl || "",
          wine_type: newWine.wineType || "",
          wine_region: newWine.region || "",
          wine_vintage: newWine.vintage || "",
          is_welcome: true,
          is_wine_intro: true
        },
      });

      // Create default slide templates for this wine
      const slideTemplates = this.getDefaultSlideTemplates();
      let localPosition = 2; // Start after the wine intro slide

      // Track position within each section for global position calculation
      const sectionCounters: Record<string, number> = { intro: 1, deep_dive: 0, ending: 0 };

      for (const template of slideTemplates.slice(1)) { // Skip the first template (intro) since we already created wine intro
        // Add wine context to all slides while preserving template structure
        const payloadJson = {
          ...template.payloadJson,
          // Add wine context as additional fields without overwriting existing structure
          wine_name: newWine.wineName,
          wine_image: newWine.wineImageUrl || "",
          wine_type: newWine.wineType || ""
        };

        // Validate payload before creating slide
        if (!payloadJson || Object.keys(payloadJson).length === 0) {
          console.error('[SLIDE_CREATE_ERROR] Empty payload detected for slide:', {
            type: template.type,
            section_type: template.section_type,
            position: localPosition
          });
          continue; // Skip this slide to prevent empty data
        }

        const sectionType = (template.section_type || 'intro') as string;
        const sectionKey = (sectionType === 'tasting') ? 'deep_dive' :
                          (sectionType === 'conclusion') ? 'ending' : sectionType;
        sectionCounters[sectionKey] = (sectionCounters[sectionKey] || 0) + 1;

        await tx.insert(slides).values({
          packageWineId: newWine.id,
          position: localPosition++,
          globalPosition: calculateGlobalPosition(sectionType, false, sectionCounters[sectionKey]),
          type: template.type,
          section_type: template.section_type,
          payloadJson: payloadJson,
        });
      }

      return newWine;
    });
  }

  async updatePackageWine(id: string, data: Partial<InsertPackageWine>): Promise<PackageWine> {
    const [updatedWine] = await db
      .update(packageWines)
      .set(data)
      .where(eq(packageWines.id, id))
      .returning();
    return updatedWine;
  }

  async deletePackageWine(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get the wine to be deleted to know its package and position
      const wineToDelete = await tx.select().from(packageWines)
        .where(eq(packageWines.id, id)).limit(1);

      if (wineToDelete.length === 0) return;

      const { packageId, position } = wineToDelete[0];

      // First delete associated slides
      await tx.delete(slides).where(eq(slides.packageWineId, id));

      // Then delete the wine
      await tx.delete(packageWines).where(eq(packageWines.id, id));

      // Update positions of wines that came after the deleted one
      await tx.update(packageWines)
        .set({ position: sql`position - 1` })
        .where(and(
          eq(packageWines.packageId, packageId),
          gt(packageWines.position, position)
        ));
    });
  }

  async updateSlide(id: string, data: Partial<InsertSlide>): Promise<Slide> {
    console.log('🗄️ Storage: updateSlide called', {
      slideId: id,
      updateData: data,
      updateDataKeys: Object.keys(data),
      payloadJsonUpdate: data.payloadJson,
      timestamp: new Date().toISOString()
    });

    const [updatedSlide] = await db
      .update(slides)
      .set(data)
      .where(eq(slides.id, id))
      .returning();

    console.log('✅ Storage: updateSlide completed', {
      slideId: id,
      updatedSlide,
      updatedPayloadJson: updatedSlide?.payloadJson,
      wasUpdated: !!updatedSlide,
      timestamp: new Date().toISOString()
    });

    return updatedSlide;
  }

  async deleteSlide(id: string): Promise<void> {
    await db.delete(slides).where(eq(slides.id, id));
  }

  // Session Wine Selections - Host wine selection feature
  async createSessionWineSelections(sessionId: string, selections: InsertSessionWineSelection[]): Promise<SessionWineSelection[]> {
    return db.transaction(async (tx) => {
      // First delete existing selections for this session
      await tx.delete(sessionWineSelections).where(eq(sessionWineSelections.sessionId, sessionId));

      // Insert new selections
      const insertData = selections.map(selection => ({
        ...selection,
        sessionId
      }));

      const newSelections = await tx
        .insert(sessionWineSelections)
        .values(insertData)
        .returning();

      return newSelections;
    });
  }

  async getSessionWineSelections(sessionId: string): Promise<(SessionWineSelection & { wine: PackageWine })[]> {
    const selections = await db
      .select({
        id: sessionWineSelections.id,
        sessionId: sessionWineSelections.sessionId,
        packageWineId: sessionWineSelections.packageWineId,
        position: sessionWineSelections.position,
        isIncluded: sessionWineSelections.isIncluded,
        createdAt: sessionWineSelections.createdAt,
        wine: {
          id: packageWines.id,
          packageId: packageWines.packageId,
          wineName: packageWines.wineName,
          wineDescription: packageWines.wineDescription,
          wineImageUrl: packageWines.wineImageUrl,
          wineType: packageWines.wineType,
          vintage: packageWines.vintage,
          region: packageWines.region,
          producer: packageWines.producer,
          grapeVarietals: packageWines.grapeVarietals,
          alcoholContent: packageWines.alcoholContent,
          position: packageWines.position,
          expectedCharacteristics: packageWines.expectedCharacteristics,
          discussionQuestions: packageWines.discussionQuestions,
          createdAt: packageWines.createdAt
        }
      })
      .from(sessionWineSelections)
      .innerJoin(packageWines, eq(sessionWineSelections.packageWineId, packageWines.id))
      .where(eq(sessionWineSelections.sessionId, sessionId))
      .orderBy(sessionWineSelections.position);

    return selections.map(selection => ({
      ...selection,
      wine: selection.wine as PackageWine
    }));
  }

  async updateSessionWineSelections(sessionId: string, selections: InsertSessionWineSelection[]): Promise<SessionWineSelection[]> {
    return this.createSessionWineSelections(sessionId, selections);
  }

  async deleteSessionWineSelections(sessionId: string): Promise<void> {
    await db
      .delete(sessionWineSelections)
      .where(eq(sessionWineSelections.sessionId, sessionId));
  }

  // NEW: Get all packages with their associated wines for the dashboard
  async getAllPackagesWithWines(): Promise<(Package & { wines: PackageWine[] })[]> {
    const allPackages = await db.select().from(packages).orderBy(packages.createdAt);
    if (allPackages.length === 0) return [];

    const packageIds = allPackages.map(p => p.id);
    const allPackageWines = await db.select().from(packageWines)
      .where(inArray(packageWines.packageId, packageIds))
      .orderBy(packageWines.position);

    return allPackages.map(pkg => ({
      ...pkg,
      wines: allPackageWines.filter(wine => wine.packageId === pkg.id),
    }));
  }

  // NEW: Get a single package with all its wines and all their slides for the editor
  async getPackageWithWinesAndSlides(packageCode: string) {
    const pkg = await this.getPackageByCode(packageCode);
    if (!pkg) {
      return null;
    }

    const wines = await this.getPackageWines(pkg.id);
    if (wines.length === 0) {
      return { ...pkg, wines: [], slides: [] };
    }

    const wineIds = wines.map(w => w.id);

    // Fetch package-level slides
    const packageSlides = await db.select()
      .from(slides)
      .where(eq(slides.packageId, pkg.id))
      .orderBy(slides.position);

    // Fetch wine-level slides
    const wineSlides = await db.select()
      .from(slides)
      .where(inArray(slides.packageWineId, wineIds))
      .orderBy(slides.position);

    // Combine all slides and sort by global position
    const allSlidesForPackage = [...packageSlides, ...wineSlides]
      .sort((a, b) => (a.globalPosition || 0) - (b.globalPosition || 0));

    return {
      ...pkg,
      wines,
      slides: allSlidesForPackage,
    };
  }

  // NEW: Update the order and wine assignment of multiple slides in a single transaction
  async updateSlidesOrder(slideUpdates: { slideId: string; packageWineId: string; position: number }[]) {
    if (slideUpdates.length === 0) return;
    return db.transaction(async (tx) => {
      await Promise.all(slideUpdates.map(update =>
        tx.update(slides)
          .set({ packageWineId: update.packageWineId, position: update.position })
          .where(eq(slides.id, update.slideId))
      ));
    });
  }

  // NEW: Normalize slide positions for a wine to ensure clean sequential numbering
  async normalizeSlidePositions(packageWineId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get all slides for this wine ordered by current position
      const wineSlides = await tx
        .select({
          id: slides.id,
          position: slides.position
        })
        .from(slides)
        .where(eq(slides.packageWineId, packageWineId))
        .orderBy(asc(slides.position));

      // Renumber slides sequentially starting from 1
      for (let i = 0; i < wineSlides.length; i++) {
        const newPosition = i + 1;
        await tx
          .update(slides)
          .set({ position: newPosition })
          .where(eq(slides.id, wineSlides[i].id));
      }
    });
  }

  // Enhanced slide position update with conflict resolution
  async updateSlidePosition(slideId: string, newPosition: number): Promise<void> {
    console.log(`🔄 Updating slide ${slideId.slice(-6)} to position ${newPosition}`);

    try {
      // Get slide info first to determine package_wine_id and section_type
      const slide = await db
        .select({
          packageWineId: slides.packageWineId,
          sectionType: slides.section_type,
          currentPosition: slides.position
        })
        .from(slides)
        .where(eq(slides.id, slideId))
        .limit(1);

      if (slide.length === 0) {
        throw new Error(`Slide ${slideId} not found`);
      }

      const { packageWineId, sectionType, currentPosition } = slide[0];

      console.log(`📍 Slide ${slideId.slice(-6)}: ${currentPosition} → ${newPosition} (section: ${sectionType || 'package-level'})`);

      if (!packageWineId || !sectionType) {
        // Fallback to simple update for package-level slides
        await db
          .update(slides)
          .set({ position: newPosition })
          .where(eq(slides.id, slideId));
        console.log(`✅ Updated package-level slide ${slideId.slice(-6)} position to ${newPosition}`);
        return;
      }

      // Use the enhanced position manager for wine-level slides
      const finalPosition = await updateSlidePositionSafely(
        slideId,
        newPosition,
        packageWineId,
        sectionType as SectionType
      );

      console.log(`✅ Successfully updated slide ${slideId} position to ${finalPosition}`);

      // Check if section needs renumbering after this operation
      if (await shouldRenumberSection(packageWineId, sectionType as SectionType)) {
        console.log(`🔧 Renumbering section ${sectionType} for wine ${packageWineId}`);
        await renumberSectionSlides(packageWineId, sectionType as SectionType);
      }

    } catch (error) {
      console.error(`❌ Failed to update slide position:`, error);
      throw error;
    }
  }

  async duplicateWineSlides(sourceWineId: string, targetWineId: string, replaceExisting: boolean): Promise<{ count: number; slides: Slide[] }> {
    try {
      // 1. Validate both wines exist and are in the same package
      const [sourceWine, targetWine] = await Promise.all([
        db.select().from(packageWines).where(eq(packageWines.id, sourceWineId)).limit(1),
        db.select().from(packageWines).where(eq(packageWines.id, targetWineId)).limit(1)
      ]);

      if (sourceWine.length === 0 || targetWine.length === 0) {
        throw new Error('Source or target wine not found');
      }

      if (sourceWine[0].packageId !== targetWine[0].packageId) {
        throw new Error('Wines must be in the same package');
      }

      // 2. Fetch source slides (EXCLUDE intro slides - only copy deep dive, ending, etc.)
      const sourceSlides = await db.select()
        .from(slides)
        .where(eq(slides.packageWineId, sourceWineId))
        .orderBy(slides.position);

      // Filter out only wine-specific intro slides, but keep intro questions and assessments
      const slidesToCopy = sourceSlides.filter(slide => {
        const payloadJson = slide.payloadJson as any;

        // EXCLUDE wine-specific intro slides (those that introduce a specific wine)
        if (payloadJson?.is_wine_intro === true) {
          console.log(`Excluding wine-specific intro: ${payloadJson.title}`);
          return false;
        }

        // EXCLUDE package-level intro slides (general package welcome)
        if (payloadJson?.is_package_intro === true) {
          console.log(`Excluding package intro: ${payloadJson.title}`);
          return false;
        }

        // EXCLUDE slides with wine-specific titles as a fallback check
        if (payloadJson?.title && sourceWine[0]) {
          const title = payloadJson.title.toLowerCase();
          const wineName = sourceWine[0].wineName.toLowerCase();

          // Check for common wine-specific intro patterns
          if (title.includes(`meet ${wineName}`) ||
              title.includes(`introduction to ${wineName}`) ||
              title.includes(`welcome to ${wineName}`) ||
              title === wineName) {
            console.log(`Excluding wine-specific title: ${payloadJson.title}`);
            return false;
          }
        }

        // INCLUDE everything else - intro questions, deep dive, ending, etc.
        return true;
      });

      if (slidesToCopy.length === 0) {
        return { count: 0, slides: [] };
      }

      // 3. Handle target wine slides if replacing
      if (replaceExisting) {
        // Delete all slides from target wine EXCEPT its own intro slide
        // This preserves the "Meet [Wine Name]" slide that belongs to the target wine
        // We use COALESCE to handle NULL/undefined values in JSON
        await db.delete(slides).where(
          and(
            eq(slides.packageWineId, targetWineId),
            sql`COALESCE(${slides.payloadJson}->>'is_wine_intro', 'false') != 'true'`
          )
        );
        console.log(`Deleted non-intro slides from target wine, preserving wine intro slide`);
      }

      // 4. Use database transaction to ensure data consistency
      const duplicatedSlides: Slide[] = [];

      await db.transaction(async (tx) => {
        // Get all existing slides for target wine within transaction
        const existingSlides = await tx.select()
          .from(slides)
          .where(eq(slides.packageWineId, targetWineId))
          .orderBy(slides.position);

        let startingPosition = 1;

        // In replace mode, we may have preserved the wine intro slide
        // We need to account for it when assigning positions
        if (replaceExisting && existingSlides.length > 0) {
          // Check if any of the existing slides is a wine intro (should be at position 1)
          const hasPreservedIntro = existingSlides.some(slide => {
            const payload = slide.payloadJson as any;
            return payload?.is_wine_intro === true;
          });

          if (hasPreservedIntro) {
            // Start copying at position 2 to avoid conflict with preserved intro
            startingPosition = 2;
          }
        } else if (!replaceExisting && existingSlides.length > 0) {
          // For append mode, find the highest position and start from there
          const maxPosition = Math.max(...existingSlides.map(s => s.position));
          startingPosition = maxPosition + 10; // Leave gap to avoid conflicts
        }

        // 5. Create duplicated slides within transaction
        for (let i = 0; i < slidesToCopy.length; i++) {
          const sourceSlide = slidesToCopy[i];
          let newPosition: number;

          if (replaceExisting) {
            // For replace mode, assign sequential positions starting from startingPosition
            // This handles the case where we preserved the intro at position 1
            newPosition = startingPosition + i;
          } else {
            // For append mode, use sequential positions starting from safe position
            newPosition = startingPosition + (i * 10); // Use gaps of 10 for future insertions
          }

          // Update wine context in payloadJson if present
          let updatedPayloadJson = { ...(sourceSlide.payloadJson || {}) } as any;

          // If the slide contains wine-specific context, update it to target wine
          if (updatedPayloadJson.wine_name || updatedPayloadJson.wine_context ||
              updatedPayloadJson.wine_type || updatedPayloadJson.wine_region) {
            updatedPayloadJson = {
              ...updatedPayloadJson,
              wine_name: targetWine[0].wineName,
              wine_type: targetWine[0].wineType || updatedPayloadJson.wine_type,
              wine_region: targetWine[0].region || updatedPayloadJson.wine_region,
              wine_vintage: targetWine[0].vintage || updatedPayloadJson.wine_vintage,
              wine_image: targetWine[0].wineImageUrl || updatedPayloadJson.wine_image
            };
          }

          const newSlideData = {
            packageWineId: targetWineId,
            type: sourceSlide.type,
            payloadJson: updatedPayloadJson,
            position: newPosition,
            section_type: sourceSlide.section_type
          };

          try {
            const [createdSlide] = await tx.insert(slides)
              .values(newSlideData)
              .returning();

            duplicatedSlides.push(createdSlide);
          } catch (error) {
            // If position conflict still occurs, find the next available position
            if (error instanceof Error && error.message.includes('duplicate key')) {
              console.warn(`Position conflict for slide ${sourceSlide.type} at position ${newPosition}, finding next available position`);

              // Find the highest position currently in use for this wine
              const currentSlides = await tx.select({ position: slides.position })
                .from(slides)
                .where(eq(slides.packageWineId, targetWineId))
                .orderBy(desc(slides.position))
                .limit(1);

              const nextAvailablePosition = (currentSlides[0]?.position || 0) + 1;

              const fallbackSlideData = {
                ...newSlideData,
                position: nextAvailablePosition
              };

              const [createdSlide] = await tx.insert(slides)
                .values(fallbackSlideData)
                .returning();

              duplicatedSlides.push(createdSlide);
              console.log(`Assigned fallback position ${nextAvailablePosition} to slide ${sourceSlide.type}`);
            } else {
              throw error;
            }
          }
        }
      });

      // Log detailed information about the duplication
      console.log(`\n📋 Slide Duplication Summary:`);
      console.log(`  Source Wine: ${sourceWine[0].wineName} (${sourceWineId})`);
      console.log(`  Target Wine: ${targetWine[0].wineName} (${targetWineId})`);
      console.log(`  Total source slides: ${sourceSlides.length}`);
      console.log(`  Slides after filtering: ${slidesToCopy.length}`);
      console.log(`  Excluded slides: ${sourceSlides.length - slidesToCopy.length}`);
      console.log(`  Mode: ${replaceExisting ? 'Replace' : 'Append'}`);
      console.log(`✅ Successfully duplicated ${duplicatedSlides.length} slides\n`);

      // Normalize positions after duplication to ensure clean sequential numbering
      await this.normalizeSlidePositions(targetWineId);

      return {
        count: duplicatedSlides.length,
        slides: duplicatedSlides
      };

    } catch (error) {
      console.error('❌ Error duplicating wine slides:', error);
      throw error;
    }
  }

  // Media methods
  async generateUniqueMediaPublicId(): Promise<string> {
    const characters = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      let result = "";
      for (let i = 0; i < 10; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
      }

      const existingMedia = await db.query.media.findFirst({
        columns: { id: true },
        where: eq(media.publicId, result),
      });

      if (!existingMedia) {
        return result;
      }
      attempts++;
    }

    // Fallback with crypto
    return crypto.randomBytes(5).toString("hex").toUpperCase();
  }

  async createMedia(mediaData: InsertMedia): Promise<Media> {
    const [created] = await db.insert(media).values(mediaData).returning();
    return created;
  }

  async getMediaByPublicId(publicId: string): Promise<Media | undefined> {
    return db.query.media.findFirst({
      where: eq(media.publicId, publicId),
    });
  }

  async getMediaById(id: string): Promise<Media | undefined> {
    return db.query.media.findFirst({
      where: eq(media.id, id),
    });
  }

  async updateMediaLastAccessed(id: string): Promise<void> {
    await db
      .update(media)
      .set({ lastAccessedAt: sql`now()` })
      .where(eq(media.id, id));
  }

  async deleteMedia(id: string): Promise<void> {
    await db.delete(media).where(eq(media.id, id));
  }

  // Position Recovery and Smart Reordering Functions

  /**
   * Detects and fixes slides stuck at temporary positions (900000000+)
   * This happens when the two-phase reorder process fails, leaving slides at temp positions
   */
  async detectAndFixTemporaryPositions(): Promise<{ fixedCount: number; wines: string[] }> {
    console.log('🔍 Checking for slides stuck at temporary positions...');

    const TEMP_BASE_POSITION = 900000000;

    // Find all slides stuck at temporary positions
    const stuckSlides = await db
      .select({
        id: slides.id,
        packageWineId: slides.packageWineId,
        position: slides.position,
        type: slides.type,
        payloadJson: slides.payloadJson
      })
      .from(slides)
      .where(gte(slides.position, TEMP_BASE_POSITION));

    if (stuckSlides.length === 0) {
      console.log('✅ No slides found at temporary positions');
      return { fixedCount: 0, wines: [] };
    }

    console.log(`🚨 Found ${stuckSlides.length} slides stuck at temporary positions`);

    // Group slides by wine
    const slidesByWine = new Map<string, typeof stuckSlides>();
    stuckSlides.forEach(slide => {
      const wineId = slide.packageWineId!;
      if (!slidesByWine.has(wineId)) {
        slidesByWine.set(wineId, []);
      }
      slidesByWine.get(wineId)!.push(slide);
    });

    const fixedWines: string[] = [];
    let totalFixed = 0;

    // Fix each wine's positions
    for (const [wineId, wineStuckSlides] of Array.from(slidesByWine.entries())) {
      console.log(`🔧 Fixing ${wineStuckSlides.length} stuck slides for wine ${wineId}`);

      // Get all slides for this wine (including non-stuck ones)
      const allWineSlides = await db
        .select()
        .from(slides)
        .where(eq(slides.packageWineId, wineId))
        .orderBy(slides.position);

      // Normalize all positions for this wine
      const fixedCount = await this.normalizeWinePositions(wineId, allWineSlides);

      if (fixedCount > 0) {
        fixedWines.push(wineId);
        totalFixed += fixedCount;
      }
    }

    console.log(`✅ Fixed ${totalFixed} slides across ${fixedWines.length} wines`);
    return { fixedCount: totalFixed, wines: fixedWines };
  }

  /**
   * Normalizes all slide positions for a wine to use sequential gap-based positions
   */
  async normalizeWinePositions(wineId: string, wineSlides?: any[]): Promise<number> {
    if (!wineSlides) {
      wineSlides = await db
        .select()
        .from(slides)
        .where(eq(slides.packageWineId, wineId))
        .orderBy(slides.position);
    }

    if (wineSlides.length === 0) {
      return 0;
    }

    console.log(`🔄 Normalizing positions for ${wineSlides.length} slides in wine ${wineId}`);

    const GAP_SIZE = 1000;
    const BASE_POSITION = 100000;
    let fixedCount = 0;

    // Sort slides by current position to maintain relative order
    const sortedSlides = [...wineSlides].sort((a, b) => {
      // Handle temporary positions - sort them last but maintain their relative order
      if (a.position >= 900000000 && b.position >= 900000000) {
        return a.position - b.position;
      }
      if (a.position >= 900000000) return 1;
      if (b.position >= 900000000) return -1;
      return a.position - b.position;
    });

    // Assign new sequential positions
    for (let i = 0; i < sortedSlides.length; i++) {
      const slide = sortedSlides[i];
      const newPosition = BASE_POSITION + (i * GAP_SIZE);

      if (slide.position !== newPosition) {
        await db
          .update(slides)
          .set({ position: newPosition })
          .where(eq(slides.id, slide.id));

        console.log(`📍 Fixed slide ${slide.id}: ${slide.position} → ${newPosition}`);
        fixedCount++;
      }
    }

    return fixedCount;
  }

  /**
   * Smart swap function that only swaps two adjacent slides without using temporary positions
   */
  async smartSwapSlides(slideId1: string, slideId2: string): Promise<void> {
    console.log(`🔄 Smart swapping slides ${slideId1} ↔ ${slideId2}`);

    await db.transaction(async (tx) => {
      // Get both slides
      const slide1 = await tx.select().from(slides).where(eq(slides.id, slideId1)).limit(1);
      const slide2 = await tx.select().from(slides).where(eq(slides.id, slideId2)).limit(1);

      if (slide1.length === 0 || slide2.length === 0) {
        throw new Error('One or both slides not found');
      }

      const pos1 = slide1[0].position;
      const pos2 = slide2[0].position;

      // Use temporary position to avoid unique constraint violation
      const tempPosition = Math.max(pos1, pos2) + 1000000; // Temporary position way above normal range

      // Three-step swap to avoid constraint violation:
      // 1. Move slide1 to temp position
      await tx.update(slides).set({ position: tempPosition }).where(eq(slides.id, slideId1));
      // 2. Move slide2 to slide1's original position
      await tx.update(slides).set({ position: pos1 }).where(eq(slides.id, slideId2));
      // 3. Move slide1 to slide2's original position
      await tx.update(slides).set({ position: pos2 }).where(eq(slides.id, slideId1));

      console.log(`✅ Swapped positions: ${slideId1}(${pos1}) ↔ ${slideId2}(${pos2})`);
    });
  }

  /**
   * Direct position assignment with conflict resolution
   */
  async assignSlidePosition(slideId: string, targetPosition: number, packageWineId?: string): Promise<void> {
    console.log(`🎯 Assigning slide ${slideId} to position ${targetPosition}`);

    await db.transaction(async (tx) => {
      // Get the slide to move
      const slideToMove = await tx.select().from(slides).where(eq(slides.id, slideId)).limit(1);
      if (slideToMove.length === 0) {
        throw new Error('Slide not found');
      }

      const currentWineId = packageWineId || slideToMove[0].packageWineId!;

      // Check if target position is occupied
      const conflictingSlide = await tx
        .select()
        .from(slides)
        .where(and(
          eq(slides.packageWineId, currentWineId),
          eq(slides.position, targetPosition),
          ne(slides.id, slideId)
        ))
        .limit(1);

      if (conflictingSlide.length > 0) {
        // Find next available position
        const nextAvailablePosition = await this.findNextAvailablePosition(currentWineId, targetPosition, tx);

        // Move the conflicting slide to the available position
        await tx
          .update(slides)
          .set({ position: nextAvailablePosition })
          .where(eq(slides.id, conflictingSlide[0].id));

        console.log(`📍 Moved conflicting slide ${conflictingSlide[0].id} to position ${nextAvailablePosition}`);
      }

      // Now assign the target position
      await tx
        .update(slides)
        .set({
          position: targetPosition,
          ...(packageWineId && { packageWineId })
        })
        .where(eq(slides.id, slideId));

      console.log(`✅ Assigned slide ${slideId} to position ${targetPosition}`);
    });
  }

  /**
   * Enhanced batch update slide positions with conflict detection and resolution
   */
  async batchUpdateSlidePositions(updates: Array<{ slideId: string; position: number; section_type?: string }>): Promise<void> {
    console.log(`📦 Batch updating ${updates.length} slide positions`);

    if (updates.length === 0) {
      return;
    }

    await db.transaction(async (tx) => {
      // Group updates by package_wine_id and section_type for validation
      const slideDetails = await Promise.all(
        updates.map(async (update) => {
          const slide = await tx
            .select({
              id: slides.id,
              packageWineId: slides.packageWineId,
              sectionType: slides.section_type,
              currentPosition: slides.position
            })
            .from(slides)
            .where(eq(slides.id, update.slideId))
            .limit(1);

          if (slide.length === 0) {
            throw new Error(`Slide ${update.slideId} not found`);
          }

          return {
            ...update,
            ...slide[0]
          };
        })
      );

      // Validate that all slides within the same wine don't have position conflicts
      const wineGroups = new Map<string, typeof slideDetails>();
      for (const detail of slideDetails) {
        const wineKey = detail.packageWineId || 'package-level';
        if (!wineGroups.has(wineKey)) {
          wineGroups.set(wineKey, []);
        }
        wineGroups.get(wineKey)!.push(detail);
      }

      // Check for position conflicts within each wine group
      for (const [wineId, wineSlides] of Array.from(wineGroups.entries())) {
        const positions = new Set<number>();
        const duplicatePositions = new Set<number>();

        for (const slide of wineSlides) {
          if (positions.has(slide.position)) {
            duplicatePositions.add(slide.position);
          }
          positions.add(slide.position);
        }

        if (duplicatePositions.size > 0) {
          console.log(`⚠️ Detected position conflicts in wine ${wineId}:`, Array.from(duplicatePositions));

          // Resolve conflicts by spreading slides with unique positions
          for (const conflictPosition of Array.from(duplicatePositions)) {
            const conflictingSlides = wineSlides.filter((s: any) => s.position === conflictPosition);

            // Keep the first slide at the original position, adjust others
            for (let i = 1; i < conflictingSlides.length; i++) {
              try {
                if (wineId !== 'package-level' && conflictingSlides[i].sectionType) {
                  const freePosition = await findNearestFreePosition(
                    wineId,
                    conflictPosition + i * 0.1,
                    conflictingSlides[i].sectionType as SectionType
                  );
                  conflictingSlides[i].position = freePosition;
                  console.log(`🔧 Adjusted slide ${conflictingSlides[i].slideId} to position ${freePosition}`);
                } else {
                  // Simple increment for package-level slides
                  conflictingSlides[i].position = conflictPosition + i * 0.1;
                }
              } catch (error) {
                // If we can't find a free position, use a temporary high position
                conflictingSlides[i].position = 900000000 + i;
                console.log(`⚠️ Using temporary position for slide ${conflictingSlides[i].slideId}`);
              }
            }
          }
        }
      }
      
      // First phase: Move all slides to temporary positions to avoid conflicts
      const tempPositionBase = 950000000; // Higher base to avoid conflicts
      
      for (let i = 0; i < slideDetails.length; i++) {
        await tx
          .update(slides)
          .set({ position: tempPositionBase + i })
          .where(eq(slides.id, slideDetails[i].slideId));
      }
      
      // Second phase: Assign final positions and section types
      for (const detail of slideDetails) {
        const updateData: any = { position: detail.position };
        if (detail.section_type) {
          updateData.section_type = detail.section_type;
        }
        
        await tx
          .update(slides)
          .set(updateData)
          .where(eq(slides.id, detail.slideId));
      }
      
      console.log(`✅ Batch updated ${updates.length} slide positions successfully`);
    });
    
    // After batch update, check if any sections need renumbering
    const processedWines = new Set<string>();
    
    for (const update of updates) {
      const slide = await db
        .select({
          packageWineId: slides.packageWineId,
          sectionType: slides.section_type
        })
        .from(slides)
        .where(eq(slides.id, update.slideId))
        .limit(1);
      
      if (slide.length > 0 && slide[0].packageWineId && slide[0].sectionType) {
        const wineKey = `${slide[0].packageWineId}-${slide[0].sectionType}`;
        
        if (!processedWines.has(wineKey)) {
          processedWines.add(wineKey);
          
          if (await shouldRenumberSection(slide[0].packageWineId, slide[0].sectionType as SectionType)) {
            console.log(`🔧 Renumbering section ${slide[0].sectionType} for wine ${slide[0].packageWineId}`);
            await renumberSectionSlides(slide[0].packageWineId, slide[0].sectionType as SectionType);
          }
        }
      }
    }
  }
  
  /**
   * Find the next available position for a wine, starting from a given position
   */
  private async findNextAvailablePosition(wineId: string, startPosition: number, tx?: any): Promise<number> {
    const dbToUse = tx || db;
    const GAP_SIZE = 1000;
    let position = startPosition + GAP_SIZE;
    
    while (true) {
      const existing = await dbToUse
        .select()
        .from(slides)
        .where(and(
          eq(slides.packageWineId, wineId),
          eq(slides.position, position)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return position;
      }
      
      position += GAP_SIZE;
    }
  }
  
  /**
   * Recovery function to check and fix any position conflicts in the database
   */
  async performPositionRecovery(): Promise<{ recovered: boolean; details: string }> {
    console.log('🔍 Starting comprehensive position recovery...');
    
    try {
      // Step 1: Fix temporary positions
      const tempFix = await this.detectAndFixTemporaryPositions();
      
      // Step 2: Check for duplicate positions within wines
      const duplicates = await db
        .select({
          packageWineId: slides.packageWineId,
          position: slides.position,
          count: sql<number>`count(*)`.as('count')
        })
        .from(slides)
        .where(isNotNull(slides.packageWineId))
        .groupBy(slides.packageWineId, slides.position)
        .having(sql`count(*) > 1`);
      
      if (duplicates.length > 0) {
        console.log(`🚨 Found ${duplicates.length} position conflicts to resolve`);
        
        for (const duplicate of duplicates) {
          const conflictingSlides = await db
            .select()
            .from(slides)
            .where(and(
              eq(slides.packageWineId, duplicate.packageWineId!),
              eq(slides.position, duplicate.position)
            ));
          
          // Keep the first slide at the original position, move others
          for (let i = 1; i < conflictingSlides.length; i++) {
            const newPosition = await this.findNextAvailablePosition(duplicate.packageWineId!, duplicate.position);
            await db
              .update(slides)
              .set({ position: newPosition })
              .where(eq(slides.id, conflictingSlides[i].id));
            
            console.log(`📍 Resolved conflict: moved slide ${conflictingSlides[i].id} to position ${newPosition}`);
          }
        }
      }
      
      const details = `Fixed ${tempFix.fixedCount} temporary positions, resolved ${duplicates.length} conflicts`;
      console.log(`✅ Position recovery completed: ${details}`);
      
      return { 
        recovered: tempFix.fixedCount > 0 || duplicates.length > 0, 
        details 
      };
      
    } catch (error) {
      console.error('❌ Position recovery failed:', error);
      return { 
        recovered: false, 
        details: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Provides minimal default payload for each slide type to allow creation of basic slides
   */
  private getDefaultPayloadForSlideType(slideType: string): any {
    switch (slideType) {
      case 'question':
        return {
          question_type: 'text',
          title: 'New Question',
          question: 'New Question',
          description: '',
          placeholder: 'Enter your answer here...',
          timeLimit: 60,
          points: 10
        };
      
      case 'video_message':
        return {
          title: 'New Video Message',
          description: '',
          video_url: '',
          autoplay: false,
          show_controls: true
        };
      
      case 'audio_message':
        return {
          title: 'New Audio Message',
          description: '',
          audio_url: '',
          autoplay: false,
          show_controls: true
        };
      
      case 'interlude':
        return {
          title: 'New Interlude',
          description: '',
          duration: 5000,
          backgroundImage: '',
          animation: 'fade'
        };
      
      case 'transition':
        return {
          title: 'New Transition',
          description: '',
          duration: 2500,
          showContinueButton: false,
          animation_type: 'fade',
          backgroundImage: ''
        };
      
      default:
        return {
          title: 'New Slide',
          description: ''
        };
    }
  }

  // User Dashboard
  async getAllParticipantsByEmail(email: string): Promise<Participant[]> {
    // Check memo cache (5s TTL)
    const cached = this.participantMemo.get(email);
    if (cached && (Date.now() - cached.timestamp) < DatabaseStorage.PARTICIPANT_MEMO_TTL_MS) {
      return cached.data;
    }

    const result = await db
      .select()
      .from(participants)
      .where(eq(participants.email, email));

    // Cap at 200 entries — evict oldest (FIFO via Map insertion order)
    if (this.participantMemo.size >= 200 && !this.participantMemo.has(email)) {
      const oldestKey = this.participantMemo.keys().next().value;
      if (oldestKey !== undefined) {
        this.participantMemo.delete(oldestKey);
      }
    }

    this.participantMemo.set(email, { data: result, timestamp: Date.now() });
    return result;
  }

  // Sprint 2.5: Unified Tasting Data (Solo + Group)
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });
    return result;
  }

  async getSoloTastingsByEmail(email: string): Promise<Tasting[]> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return [];
    }

    const result = await db
      .select()
      .from(tastings)
      .where(eq(tastings.userId, user.id))
      .orderBy(desc(tastings.tastedAt));

    return result;
  }

  async getUnifiedTastingStats(email: string): Promise<{ total: number; solo: number; group: number }> {
    // Get solo tasting count
    const user = await this.getUserByEmail(email);
    let soloCount = 0;

    if (user) {
      const soloResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tastings)
        .where(eq(tastings.userId, user.id));
      soloCount = soloResult[0]?.count || 0;
    }

    // Get group tasting count (unique sessions)
    const groupParticipants = await this.getAllParticipantsByEmail(email);
    const uniqueSessionIds = new Set(
      groupParticipants.map(p => p.sessionId).filter(Boolean)
    );
    const groupCount = uniqueSessionIds.size;

    return {
      total: soloCount + groupCount,
      solo: soloCount,
      group: groupCount
    };
  }

  // Sprint 4.1: Get solo tasting preferences for unified dashboard
  async getSoloTastingPreferences(userId: number): Promise<{
    sweetness: number | null;
    acidity: number | null;
    tannins: number | null;
    body: number | null;
    count: number;
  }> {
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
        COUNT(*) as count
      FROM tastings
      WHERE user_id = ${userId}
    `);

    const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];
    return {
      sweetness: row?.sweetness ? Number(row.sweetness) : null,
      acidity: row?.acidity ? Number(row.acidity) : null,
      tannins: row?.tannins ? Number(row.tannins) : null,
      body: row?.body ? Number(row.body) : null,
      count: row?.count ? Number(row.count) : 0
    };
  }

  // Sprint 4.1: Get group tasting preferences for unified dashboard
  async getGroupTastingPreferences(email: string): Promise<{
    sweetness: number | null;
    acidity: number | null;
    tannins: number | null;
    body: number | null;
    count: number;
  }> {
    // Get all participant records for this email
    const userParticipants = await this.getAllParticipantsByEmail(email);

    if (userParticipants.length === 0) {
      return { sweetness: null, acidity: null, tannins: null, body: null, count: 0 };
    }

    const participantIds = userParticipants.map(p => p.id);

    // Query responses using drizzle's inArray for proper array handling
    const responseRows = await db
      .select({
        sweetness: sql<string>`answer_json->>'sweetness'`,
        acidity: sql<string>`answer_json->>'acidity'`,
        tannins: sql<string>`answer_json->>'tannins'`,
        body: sql<string>`answer_json->>'body'`,
      })
      .from(responses)
      .where(inArray(responses.participantId, participantIds));

    // Calculate averages manually
    let sweetnessSum = 0, sweetnessCount = 0;
    let aciditySum = 0, acidityCount = 0;
    let tanninsSum = 0, tanninsCount = 0;
    let bodySum = 0, bodyCount = 0;

    for (const row of responseRows) {
      if (row.sweetness) { sweetnessSum += Number(row.sweetness); sweetnessCount++; }
      if (row.acidity) { aciditySum += Number(row.acidity); acidityCount++; }
      if (row.tannins) { tanninsSum += Number(row.tannins); tanninsCount++; }
      if (row.body) { bodySum += Number(row.body); bodyCount++; }
    }

    const result = [{
      sweetness: sweetnessCount > 0 ? sweetnessSum / sweetnessCount : null,
      acidity: acidityCount > 0 ? aciditySum / acidityCount : null,
      tannins: tanninsCount > 0 ? tanninsSum / tanninsCount : null,
      body: bodyCount > 0 ? bodySum / bodyCount : null,
      count: Math.max(sweetnessCount, acidityCount, tanninsCount, bodyCount)
    }];

    const row = Array.isArray(result) ? result[0] : (result as any).rows?.[0];

    // If no explicit taste data, try alternative field paths
    if (!row?.sweetness && !row?.acidity && !row?.tannins && !row?.body) {
      // Fallback: count unique sessions as tastings
      const uniqueSessions = new Set(userParticipants.map(p => p.sessionId).filter(Boolean));
      return {
        sweetness: null,
        acidity: null,
        tannins: null,
        body: null,
        count: uniqueSessions.size
      };
    }

    return {
      sweetness: row?.sweetness ? Number(row.sweetness) : null,
      acidity: row?.acidity ? Number(row.acidity) : null,
      tannins: row?.tannins ? Number(row.tannins) : null,
      body: row?.body ? Number(row.body) : null,
      count: row?.count ? Number(row.count) : 0
    };
  }

  async getUserDashboardData(email: string): Promise<any> {
    // ============================================
    // Sprint 2.5: Unified Dashboard Data (Solo + Group)
    // ============================================

    // Get unified tasting stats first
    const unifiedStats = await this.getUnifiedTastingStats(email);

    // If no tastings at all (neither group nor solo), return null
    if (unifiedStats.total === 0) {
      return null;
    }

    // Get all participants with this email (for group tastings)
    const userParticipants = await db.select().from(participants).where(eq(participants.email, email));

    // Get solo tastings
    const soloTastings = await this.getSoloTastingsByEmail(email);

    // Determine display name (prefer participant name, fall back to email)
    const displayName = userParticipants[0]?.displayName || email.split('@')[0] || 'Wine Enthusiast';

    // Initialize counts and collections
    let totalGroupSessions = 0;
    let completedGroupSessions = 0;
    let totalResponses = 0;
    let userSessions: any[] = [];
    const wineDetails = new Map();
    // Track scores by region and grape for calculating averages
    const regionScores = new Map<string, number[]>();
    const grapeScores = new Map<string, number[]>();
    let allScores: number[] = [];

    // ============================================
    // 1. Process GROUP tasting data
    // ============================================
    const sessionIds = userParticipants.map(p => p.sessionId).filter(Boolean) as string[];

    if (sessionIds.length > 0) {
      userSessions = await db
          .select()
          .from(sessions)
          .where(inArray(sessions.id, sessionIds))
          .orderBy(desc(sessions.startedAt));

      totalGroupSessions = userSessions.length;
      completedGroupSessions = userSessions.filter((s: any) => s.status === 'completed').length;

      // Get all responses for these participants
      const participantIds = userParticipants.map(p => p.id);
      const userResponses = await db
          .select()
          .from(responses)
          .where(inArray(responses.participantId, participantIds));

      totalResponses = userResponses.length;

      // Fetch slides and wines for group tastings
      const slideIds = Array.from(new Set(userResponses.map(r => r.slideId).filter(Boolean) as string[]));
      const allSlides = slideIds.length > 0 ? await db.select().from(slides).where(inArray(slides.id, slideIds)) : [];
      const slidesMap = new Map(allSlides.map(s => [s.id, s]));

      const wineIds = Array.from(new Set(allSlides.map(s => s.packageWineId).filter(Boolean) as string[]));
      const allWines = wineIds.length > 0 ? await db.select().from(packageWines).where(inArray(packageWines.id, wineIds)) : [];
      const winesMap = new Map(allWines.map(w => [w.id, w]));

      // Track scores per wine for calculating averages
      const wineScoresMap = new Map<string, number[]>();

      // Process group responses
      for (const response of userResponses) {
        if (response.slideId) {
          const slide = slidesMap.get(response.slideId);
          if (slide?.packageWineId) {
            const wine = winesMap.get(slide.packageWineId);

            if (wine) {
              // Initialize wine in details if not exists
              if (!wineDetails.has(wine.id)) {
                wineDetails.set(wine.id, { ...wine, scores: [] });
              }

              // Extract and track score for this wine
              const score = this.extractScoreFromResponse(response);
              if (score !== null) {
                allScores.push(score);
                const scores = wineScoresMap.get(wine.id) || [];
                scores.push(score);
                wineScoresMap.set(wine.id, scores);
              }
            }
          }
        }
      }

      // Calculate average score for each group wine
      wineScoresMap.forEach((scores, wineId) => {
        const wineData = wineDetails.get(wineId);
        if (wineData && scores.length > 0) {
          wineData.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          wineDetails.set(wineId, wineData);
        }
      });
    }

    // ============================================
    // 2. Process SOLO tasting data
    // ============================================
    for (const tasting of soloTastings) {
      // Extract score from solo tasting
      const tastingResponses = tasting.responses as any;
      const overallScore =
        tastingResponses?.overall?.rating ||
        tastingResponses?.overall_rating ||
        0;

      // Add to wine details with score
      wineDetails.set(`solo-${tasting.id}`, {
        id: `solo-${tasting.id}`,
        wineName: tasting.wineName,
        region: tasting.wineRegion,
        grapeVarietals: tasting.grapeVariety ? [tasting.grapeVariety] : [],
        wineType: tasting.wineType,
        averageScore: overallScore
      });

      if (overallScore > 0) {
        allScores.push(overallScore);
      }
    }

    // ============================================
    // 3. Calculate combined statistics
    // ============================================
    const totalWines = wineDetails.size;
    const averageScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    // Collect scores by region and grape from unique wines
    wineDetails.forEach((wine: any) => {
      // Get the wine's score (use averageScore if available, otherwise try to extract from allScores context)
      const wineScore = wine.averageScore || wine.score || 0;

      if (wine.region && wineScore > 0) {
        const scores = regionScores.get(wine.region) || [];
        scores.push(wineScore);
        regionScores.set(wine.region, scores);
      }
      if (wine.grapeVarietals && Array.isArray(wine.grapeVarietals) && wineScore > 0) {
        wine.grapeVarietals.forEach((grape: string) => {
          const scores = grapeScores.get(grape) || [];
          scores.push(wineScore);
          grapeScores.set(grape, scores);
        });
      }
    });

    const topRegion = this.getTopPreferenceByRating(regionScores);
    const topGrape = this.getTopPreferenceByRating(grapeScores);

    // Determine favorite wine type from all tastings
    const wineTypes = new Map<string, number>();
    wineDetails.forEach((wine: any) => {
      if (wine.wineType) {
        wineTypes.set(wine.wineType, (wineTypes.get(wine.wineType) || 0) + 1);
      }
    });
    let favoriteWineType = "Unknown";
    let maxTypeCount = 0;
    wineTypes.forEach((count, type) => {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        favoriteWineType = type.charAt(0).toUpperCase() + type.slice(1) + " Wine";
      }
    });

    return {
      user: {
        email,
        displayName,
        totalSessions: totalGroupSessions,
        completedSessions: completedGroupSessions,
        totalResponses,
        uniqueWinesTasted: totalWines
      },
      recentSessions: userSessions.slice(0, 5).map((session: any) => ({
        id: session.id,
        packageId: session.packageId,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      })),
      stats: {
        averageScore,
        favoriteWineType,
        totalTastings: unifiedStats.total
      },
      topPreferences: {
        topRegion,
        topGrape,
        averageRating: { score: averageScore, totalWines }
      },
      // Sprint 2.5: Unified tasting stats
      unifiedTastingStats: unifiedStats
    };
  }

  async getUserWineScores(email: string): Promise<any> {
    const wineScores: Record<string, any> = {};

    // ============================================
    // 1. Get GROUP tasting wines (from participants -> responses)
    // ============================================
    const userParticipants = await this.getAllParticipantsByEmail(email);

    if (userParticipants.length > 0) {
      const participantIds = userParticipants.map(p => p.id);

      // Optimized: Fetch all responses with related wine data in a single query
      const responsesWithDetails = await db
          .select({
            response: responses,
            wine: packageWines
          })
          .from(responses)
          .innerJoin(slides, eq(responses.slideId, slides.id))
          .innerJoin(packageWines, eq(slides.packageWineId, packageWines.id))
          .where(inArray(responses.participantId, participantIds));

      // Group responses by wine and calculate scores in memory
      for (const { response, wine } of responsesWithDetails) {
        if (!wineScores[wine.id]) {
          wineScores[wine.id] = {
            wineId: wine.id,
            wineName: wine.wineName,
            wineDescription: wine.wineDescription,
            wineImageUrl: wine.wineImageUrl,
            producer: wine.producer,
            region: wine.region,
            vintage: wine.vintage,
            wineType: wine.wineType,
            grapeVarietals: wine.grapeVarietals,
            alcoholContent: wine.alcoholContent,
            expectedCharacteristics: wine.expectedCharacteristics,
            discussionQuestions: wine.discussionQuestions,
            scores: [],
            averageScore: 0,
            totalRatings: 0,
            source: 'group' // Track source for UI
          };
        }

        const score = this.extractScoreFromResponse(response);
        if (score !== null) {
          wineScores[wine.id].scores.push(score);
        }
      }
    }

    // ============================================
    // 2. Get SOLO tasting wines (from users -> tastings)
    // ============================================
    const soloTastings = await this.getSoloTastingsByEmail(email);

    for (const tasting of soloTastings) {
      const soloId = `solo-${tasting.id}`;

      // Extract overall rating from tasting responses
      const tastingResponses = tasting.responses as any;
      let overallScore = 0;

      if (tastingResponses) {
        // Try different possible locations for overall rating
        overallScore =
          tastingResponses?.overall?.rating ||
          tastingResponses?.overall_rating ||
          tastingResponses?.overall?.notes?.rating ||
          0;
      }

      wineScores[soloId] = {
        wineId: soloId,
        wineName: tasting.wineName,
        wineDescription: '',
        wineImageUrl: tasting.photoUrl || '',
        producer: null,
        region: tasting.wineRegion,
        vintage: tasting.wineVintage,
        wineType: tasting.wineType,
        grapeVarietals: tasting.grapeVariety ? [tasting.grapeVariety] : [],
        alcoholContent: null,
        expectedCharacteristics: tasting.wineCharacteristics,
        discussionQuestions: null,
        scores: overallScore > 0 ? [overallScore] : [],
        averageScore: overallScore,
        totalRatings: overallScore > 0 ? 1 : 0,
        source: 'solo', // Track source for UI
        tastedAt: tasting.tastedAt,
        // Include full tasting responses for WineInsights component
        tastingResponses: tastingResponses
      };
    }

    // ============================================
    // 3. Calculate averages and add metadata
    // ============================================
    Object.values(wineScores).forEach((wineScore: any) => {
      if (wineScore.scores.length > 0) {
        wineScore.averageScore = wineScore.scores.reduce((a: number, b: number) => a + b, 0) / wineScore.scores.length;
        wineScore.totalRatings = wineScore.scores.length;
      }

      wineScore.price = this.generatePlaceholderPrice(wineScore.averageScore, wineScore.region);
      wineScore.isFavorite = wineScore.averageScore >= 4;
    });

    return {
      scores: Object.values(wineScores).sort((a: any, b: any) => b.averageScore - a.averageScore)
    };
  }

  async getUserTasteProfileData(email: string): Promise<{ scores: any[]; dashboardData: any } | null> {
    const wineScores: Record<string, any> = {};

    // ============================================
    // 1. Get GROUP tasting wines (from participants -> responses)
    // ============================================
    const userParticipants = await this.getAllParticipantsByEmail(email);

    if (userParticipants.length > 0) {
      const participantIds = userParticipants.map(p => p.id);

      // Fetch all responses and related slide/wine data
      const responsesWithDetails = await db
          .select({
            response: responses,
            slide: {
              packageWineId: slides.packageWineId
            },
            wine: packageWines
          })
          .from(responses)
          .leftJoin(slides, eq(responses.slideId, slides.id))
          .leftJoin(packageWines, eq(slides.packageWineId, packageWines.id))
          .where(inArray(responses.participantId, participantIds));

      for (const { response, wine } of responsesWithDetails) {
        if (wine) {
          if (!wineScores[wine.id]) {
            wineScores[wine.id] = {
              wineId: wine.id,
              wineName: wine.wineName,
              wineDescription: wine.wineDescription,
              wineImageUrl: wine.wineImageUrl,
              producer: wine.producer,
              region: wine.region,
              vintage: wine.vintage,
              wineType: wine.wineType,
              grapeVarietals: wine.grapeVarietals,
              alcoholContent: wine.alcoholContent,
              expectedCharacteristics: wine.expectedCharacteristics,
              scores: [],
              averageScore: 0,
              totalRatings: 0,
              source: 'group'
            };
          }
          const score = this.extractScoreFromResponse(response);
          if (score !== null) {
            wineScores[wine.id].scores.push(score);
          }
        }
      }
    }

    // ============================================
    // 2. Get SOLO tasting wines (from users -> tastings)
    // ============================================
    const soloTastings = await this.getSoloTastingsByEmail(email);

    for (const tasting of soloTastings) {
      const wineKey = `solo-${tasting.id}`;

      // Extract rating from solo tasting responses
      const tastingResponses = tasting.responses as any;
      const overallScore =
        tastingResponses?.overall?.rating ||
        tastingResponses?.overall_rating ||
        0;

      wineScores[wineKey] = {
        wineId: wineKey,
        wineName: tasting.wineName,
        wineDescription: '',
        wineImageUrl: tasting.photoUrl || '',
        producer: '',
        region: tasting.wineRegion,
        vintage: tasting.wineVintage,
        wineType: tasting.wineType,
        grapeVarietals: tasting.grapeVariety ? [tasting.grapeVariety] : [],
        alcoholContent: '',
        expectedCharacteristics: tasting.wineCharacteristics,
        scores: overallScore > 0 ? [overallScore] : [],
        averageScore: overallScore,
        totalRatings: overallScore > 0 ? 1 : 0,
        source: 'solo'
      };
    }

    // ============================================
    // 3. Check if we have any data
    // ============================================
    if (Object.keys(wineScores).length === 0) {
      return null;
    }

    // Get dashboard data (also unified now)
    const dashboardData = await this.getUserDashboardData(email);
    if (!dashboardData) {
      return null;
    }

    // ============================================
    // 4. Calculate averages and finalize the scores object
    // ============================================
    Object.values(wineScores).forEach((wineScore: any) => {
      if (wineScore.scores.length > 0) {
        wineScore.averageScore = wineScore.scores.reduce((a: number, b: number) => a + b, 0) / wineScore.scores.length;
        wineScore.totalRatings = wineScore.scores.length;
      }
      wineScore.price = this.generatePlaceholderPrice(wineScore.averageScore, wineScore.region);
      wineScore.isFavorite = Math.random() > 0.7;
    });

    const sortedScores = Object.values(wineScores).sort((a: any, b: any) => b.averageScore - a.averageScore);

    return {
      scores: sortedScores,
      dashboardData
    };
  }

  async getUserTastingHistory(email: string, options: { limit: number; offset: number }): Promise<any> {
    const allHistory: any[] = [];

    // ============================================
    // 1. Get GROUP tasting history (from participants -> sessions)
    // ============================================
    const userParticipants = await this.getAllParticipantsByEmail(email);
    const sessionIds = userParticipants.map(p => p.sessionId).filter(Boolean) as string[];

    if (sessionIds.length > 0) {
      // Get sessions with package info
      const sessionsWithPackages = await db
        .select({
          session: sessions,
          package: packages
        })
        .from(sessions)
        .leftJoin(packages, eq(sessions.packageId, packages.id))
        .where(inArray(sessions.id, sessionIds))
        .orderBy(desc(sessions.startedAt));

      // Bulk fetch all participants for all sessions (1 query instead of S)
      const allParticipants = await db.select().from(participants)
        .where(inArray(participants.sessionId, sessionIds));

      // Group participants by sessionId
      const participantsBySession = new Map<string, typeof allParticipants>();
      for (const p of allParticipants) {
        const key = p.sessionId!;
        if (!participantsBySession.has(key)) participantsBySession.set(key, []);
        participantsBySession.get(key)!.push(p);
      }

      // Bulk fetch all responses for all participants (1 query instead of S*P)
      const allParticipantIds = allParticipants.map(p => p.id);
      let responsesByParticipant = new Map<string, (Response & { package_wine_id: string })[]>();
      if (allParticipantIds.length > 0) {
        const allResponsesRaw = await db
          .select({
            response: responses,
            packageWineId: slides.packageWineId,
          })
          .from(responses)
          .leftJoin(slides, eq(responses.slideId, slides.id))
          .where(inArray(responses.participantId, allParticipantIds));

        for (const r of allResponsesRaw) {
          const key = r.response.participantId!;
          if (!responsesByParticipant.has(key)) responsesByParticipant.set(key, []);
          responsesByParticipant.get(key)!.push({
            ...r.response,
            package_wine_id: r.packageWineId || '',
          });
        }
      }

      // Synchronous map — no more per-session queries
      const groupHistory = sessionsWithPackages.map(({ session, package: pkg }) => {
        const sommelier = this.getPlaceholderSommelier(session.id);
        const winesTasted = Math.floor(Math.random() * 8) + 4; // 4-11 wines
        let userScore = 0;
        let groupScore = 0;
        const sessionParticipants = participantsBySession.get(session.id) || [];
        const userParticipant = sessionParticipants.find(p => p.email === email);
        if (userParticipant) {
          const userResponses = responsesByParticipant.get(userParticipant.id) || [];
          const allParticipantResponses: (Response & { package_wine_id: string })[] = [];
          for (const participant of sessionParticipants) {
            const pResponses = responsesByParticipant.get(participant.id) || [];
            allParticipantResponses.push(...pResponses);
          }
          userScore = storage.calculateAverageScore(userResponses);
          groupScore = storage.calculateAverageScore(allParticipantResponses);
        }

        return {
          sessionId: session.id,
          packageId: session.packageId,
          packageName: pkg?.name || 'Unknown Package',
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          activeParticipants: session.activeParticipants || 0,
          sommelier,
          winesTasted,
          userScore: userScore.toFixed(1),
          groupScore: groupScore.toFixed(1),
          duration: Math.floor(Math.random() * 120) + 90, // 90-210 minutes
          location: this.getPlaceholderLocation(),
          source: 'group' // Track source for UI
        };
      });

      allHistory.push(...groupHistory);
    }

    // ============================================
    // 2. Get SOLO tasting history (from users -> tastings)
    // ============================================
    const soloTastings = await this.getSoloTastingsByEmail(email);

    for (const tasting of soloTastings) {
      // Extract overall rating from tasting responses
      const tastingResponses = tasting.responses as any;
      let userScore = 0;

      if (tastingResponses) {
        userScore =
          tastingResponses?.overall?.rating ||
          tastingResponses?.overall_rating ||
          0;
      }

      allHistory.push({
        sessionId: `solo-${tasting.id}`,
        packageId: null,
        packageName: tasting.wineName, // Use wine name as "session" name for solo tastings
        status: 'completed',
        startedAt: tasting.tastedAt,
        completedAt: tasting.tastedAt,
        activeParticipants: 1,
        sommelier: null, // No sommelier for solo tastings
        winesTasted: 1,
        userScore: userScore.toFixed(1),
        groupScore: null, // No group for solo tastings
        duration: 5, // Estimated solo tasting duration
        location: 'Solo Tasting',
        source: 'solo', // Track source for UI
        wineRegion: tasting.wineRegion,
        wineVintage: tasting.wineVintage,
        wineType: tasting.wineType,
        photoUrl: tasting.photoUrl,
        wineCharacteristics: tasting.wineCharacteristics
      });
    }

    // ============================================
    // 3. Sort combined history by date (newest first)
    // ============================================
    allHistory.sort((a, b) => {
      const dateA = new Date(a.startedAt || a.completedAt).getTime();
      const dateB = new Date(b.startedAt || b.completedAt).getTime();
      return dateB - dateA;
    });

    // Calculate total count
    const totalCount = allHistory.length;

    // Apply pagination
    const paginatedHistory = allHistory.slice(options.offset, options.offset + options.limit);

    return {
      history: paginatedHistory,
      total: totalCount
    };
  }

  calculateAverageScore(userResponses: Response[]): number {
    const scores = userResponses
      .map(r => this.extractScoreFromResponse(r))
      .filter(score => score !== null);
    
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private getFavoriteWineType(userResponses: Response[]): string {
    // This is a simplified implementation
    // In a real app, you'd analyze the wine types from the responses
    return "Red Wine"; // Placeholder
  }

  private extractScoreFromResponse(response: Response): number | null {
    try {
      const answerJson = response.answerJson;
      if (!answerJson) return null;

      // Handle different response formats
      if (typeof answerJson === 'number') {
        return answerJson;
      }
      
      if (typeof answerJson === 'object') {
        // Check for common score fields
        if ('score' in answerJson && typeof answerJson.score === 'number') return answerJson.score;
        if ('rating' in answerJson && typeof answerJson.rating === 'number') return answerJson.rating;
        if ('value' in answerJson && typeof answerJson.value === 'number') return answerJson.value;
        
        // Check for scale responses (1-10, 1-5, etc.)
        if ('selectedOption' in answerJson) {
          const option = answerJson.selectedOption;
          if (typeof option === 'number') return option;
          if (typeof option === 'string') {
            const num = parseInt(option);
            if (!isNaN(num)) return num;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting score from response:', error);
      return null;
    }
  }

  private getTopPreference(map: Map<string, number>, total: number): { name: string; count: number; percentage: number } {
    let topName = "None";
    let topCount = 0;
    let topPercentage = 0;

    Array.from(map.entries()).forEach(([name, count]) => {
      if (count > topCount) {
        topName = name;
        topCount = count;
        topPercentage = (count / total) * 100;
      }
    });

    return { name: topName, count: topCount, percentage: topPercentage };
  }

  // Get top preference by highest average rating (not frequency)
  private getTopPreferenceByRating(scoresMap: Map<string, number[]>): { name: string; count: number; avgRating: number } {
    let topName = "None";
    let topCount = 0;
    let topAvgRating = 0;

    Array.from(scoresMap.entries()).forEach(([name, scores]) => {
      if (scores.length > 0) {
        const avgRating = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Prefer higher average, break ties with more wines
        if (avgRating > topAvgRating || (avgRating === topAvgRating && scores.length > topCount)) {
          topName = name;
          topCount = scores.length;
          topAvgRating = avgRating;
        }
      }
    });

    return { name: topName, count: topCount, avgRating: Math.round(topAvgRating * 10) / 10 };
  }

  private generatePlaceholderPrice(averageScore: number, region?: string): number {
    // Generate a realistic price based on score and region
    let basePrice = 25;
    
    // Adjust based on score (higher scores = higher prices)
    if (averageScore >= 4.5) basePrice = 150;
    else if (averageScore >= 4.0) basePrice = 75;
    else if (averageScore >= 3.5) basePrice = 45;
    
    // Adjust based on region prestige
    if (region) {
      const regionLower = region.toLowerCase();
      if (regionLower.includes('bordeaux') || regionLower.includes('burgundy')) basePrice *= 1.5;
      if (regionLower.includes('napa') || regionLower.includes('tuscany')) basePrice *= 1.3;
      if (regionLower.includes('champagne')) basePrice *= 2.0;
    }
    
    // Add some randomness
    const variation = 0.8 + (Math.random() * 0.4); // ±20% variation
    return Math.round(basePrice * variation);
  }

  private getPlaceholderSommelier(sessionId: string): any {
    const sommeliers = [
      {
        name: "Marie Dubois",
        title: "Master Sommelier",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"
      },
      {
        name: "Alessandro Romano",
        title: "Advanced Sommelier",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"
      },
      {
        name: "Sarah Chen",
        title: "Certified Sommelier",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"
      },
      {
        name: "Pierre Laurent",
        title: "Master Sommelier",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&h=150"
      }
    ];
    
    // Use sessionId to consistently assign sommeliers
    const index = parseInt(sessionId.slice(-1), 16) % sommeliers.length;
    return sommeliers[index];
  }

  private getPlaceholderLocation(): string {
    const locations = [
      "Private Dining Room, The Metropolitan",
      "Osteria del Vino",
      "Rooftop Terrace, Wine & Dine",
      "Château Cellar, Bordeaux Estate",
      "Tuscan Villa, Montepulciano",
      "Napa Valley Winery, St. Helena"
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }

  async getUserSommelierFeedback(email: string): Promise<string[]> {
    try {
      const result = await db
        .select({
          sommelier_feedback: participants.sommelier_feedback
        })
        .from(participants)
        .where(and(
          eq(participants.email, email),
          isNotNull(participants.sommelier_feedback)
        ))
        .orderBy(desc(participants.createdAt));

      return result
        .map((row: any) => row.sommelier_feedback)
        .filter((feedback: any) => feedback && feedback.trim().length > 0);
    } catch (error) {
      console.error("Error fetching sommelier feedback:", error);
      return [];
    }
  }

  async generateSommelierTips(email: string): Promise<SommelierTips> {
    return generateSommelierTips(email);
  }

  // ============================================
  // LEARNING JOURNEYS (Sprint 3)
  // ============================================

  async getPublishedJourneys(filters?: { difficulty?: string; wineType?: string }): Promise<Journey[]> {
    try {
      let query = db.select().from(journeys).where(eq(journeys.isPublished, true));

      const result = await query.orderBy(desc(journeys.createdAt));

      // Apply filters in memory for simplicity
      let filtered = result;
      if (filters?.difficulty) {
        filtered = filtered.filter(j => j.difficultyLevel === filters.difficulty);
      }
      if (filters?.wineType) {
        filtered = filtered.filter(j => j.wineType === filters.wineType);
      }

      return filtered;
    } catch (error) {
      console.error("Error fetching published journeys:", error);
      return [];
    }
  }

  async getJourneyWithChapters(journeyId: number): Promise<{ journey: Journey; chapters: Chapter[] } | null> {
    try {
      const journey = await db.query.journeys.findFirst({
        where: eq(journeys.id, journeyId)
      });

      if (!journey) return null;

      const journeyChapters = await db
        .select()
        .from(chapters)
        .where(eq(chapters.journeyId, journeyId))
        .orderBy(asc(chapters.chapterNumber));

      return { journey, chapters: journeyChapters };
    } catch (error) {
      console.error("Error fetching journey with chapters:", error);
      return null;
    }
  }

  async getUserJourneyProgress(email: string, journeyId: number): Promise<UserJourney | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return null;

      const progress = await db.query.userJourneys.findFirst({
        where: and(
          eq(userJourneys.userId, user.id),
          eq(userJourneys.journeyId, journeyId)
        )
      });

      return progress || null;
    } catch (error) {
      console.error("Error fetching user journey progress:", error);
      return null;
    }
  }

  async startJourney(email: string, journeyId: number): Promise<UserJourney> {
    // Get or create user
    let user = await this.getUserByEmail(email);
    if (!user) {
      const [newUser] = await db.insert(users).values({ email }).returning();
      user = newUser;
    }

    // Check if already enrolled
    const existing = await db.query.userJourneys.findFirst({
      where: and(
        eq(userJourneys.userId, user.id),
        eq(userJourneys.journeyId, journeyId)
      )
    });

    if (existing) {
      return existing;
    }

    // Create new enrollment
    const [userJourney] = await db
      .insert(userJourneys)
      .values({
        userId: user.id,
        journeyId: journeyId,
        currentChapter: 1,
        completedChapters: []
      })
      .returning();

    return userJourney;
  }

  async completeChapter(
    email: string,
    journeyId: number,
    chapterId: number,
    tastingId: number
  ): Promise<UserJourney | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return null;

      const userJourney = await db.query.userJourneys.findFirst({
        where: and(
          eq(userJourneys.userId, user.id),
          eq(userJourneys.journeyId, journeyId)
        )
      });

      if (!userJourney) return null;

      // Get chapter info to determine next chapter
      const chapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId)
      });

      if (!chapter) return null;

      // Update completed chapters array
      const completedChaptersArray = (userJourney.completedChapters as CompletedChapter[]) || [];
      const alreadyCompleted = completedChaptersArray.some(c => c.chapterId === chapterId);

      if (!alreadyCompleted) {
        completedChaptersArray.push({
          chapterId,
          completedAt: new Date().toISOString(),
          tastingId
        });
      }

      // Check if journey is complete
      const journeyData = await this.getJourneyWithChapters(journeyId);
      const isComplete = journeyData && completedChaptersArray.length >= journeyData.chapters.length;

      // Update user journey
      const [updated] = await db
        .update(userJourneys)
        .set({
          completedChapters: completedChaptersArray,
          currentChapter: isComplete ? chapter.chapterNumber : chapter.chapterNumber + 1,
          lastActivityAt: sql`now()`,
          completedAt: isComplete ? sql`now()` : null
        })
        .where(eq(userJourneys.id, userJourney.id))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error completing chapter:", error);
      return null;
    }
  }

  async getUserActiveJourneys(email: string): Promise<Array<{
    userJourney: UserJourney;
    journey: Journey;
    chapters: Chapter[];
    progress: number;
  }>> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) return [];

      // Fetch user journeys with journey data in a single query (fix N+1)
      const userJourneyWithJourney = await db
        .select({
          userJourney: userJourneys,
          journey: journeys
        })
        .from(userJourneys)
        .innerJoin(journeys, eq(userJourneys.journeyId, journeys.id))
        .where(eq(userJourneys.userId, user.id))
        .orderBy(desc(userJourneys.lastActivityAt));

      if (userJourneyWithJourney.length === 0) return [];

      // Get all journey IDs to fetch chapters in a single query
      const journeyIds = userJourneyWithJourney.map(r => r.journey.id);

      // Fetch all chapters for all journeys in one query
      const allChapters = await db
        .select()
        .from(chapters)
        .where(sql`${chapters.journeyId} IN (${sql.join(journeyIds, sql`, `)})`)
        .orderBy(chapters.chapterNumber);

      // Group chapters by journey ID
      const chaptersByJourney = new Map<number, Chapter[]>();
      for (const chapter of allChapters) {
        const existing = chaptersByJourney.get(chapter.journeyId) || [];
        existing.push(chapter);
        chaptersByJourney.set(chapter.journeyId, existing);
      }

      // Build result with progress calculation
      const result = userJourneyWithJourney.map(({ userJourney, journey }) => {
        const journeyChapters = chaptersByJourney.get(journey.id) || [];
        const completedCount = (userJourney.completedChapters as CompletedChapter[])?.length || 0;
        const totalChapters = journeyChapters.length;
        const progress = totalChapters > 0 ? (completedCount / totalChapters) * 100 : 0;

        return {
          userJourney,
          journey,
          chapters: journeyChapters,
          progress: Math.round(progress)
        };
      });

      return result;
    } catch (error) {
      console.error("Error fetching user active journeys:", error);
      return [];
    }
  }

  async createJourney(data: InsertJourney): Promise<Journey> {
    const [journey] = await db.insert(journeys).values(data).returning();
    return journey;
  }

  async createChapter(data: InsertChapter): Promise<Chapter> {
    const [chapter] = await db.insert(chapters).values(data).returning();

    // Update journey total chapters count
    await db
      .update(journeys)
      .set({
        totalChapters: sql`${journeys.totalChapters} + 1`,
        updatedAt: sql`now()`
      })
      .where(eq(journeys.id, data.journeyId));

    return chapter;
  }

  // ============================================
  // SPRINT 5: ADDITIONAL JOURNEY/CHAPTER CRUD
  // ============================================

  async getChapterById(chapterId: number): Promise<Chapter | null> {
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId)
    });
    return chapter || null;
  }

  async updateJourney(journeyId: number, updates: Partial<InsertJourney>): Promise<Journey | null> {
    const [updated] = await db
      .update(journeys)
      .set({
        ...updates,
        updatedAt: sql`now()`
      })
      .where(eq(journeys.id, journeyId))
      .returning();
    return updated || null;
  }

  async deleteJourney(journeyId: number): Promise<void> {
    // Chapters will be cascade deleted due to foreign key constraint
    await db.delete(journeys).where(eq(journeys.id, journeyId));
  }

  async updateChapter(chapterId: number, updates: Partial<InsertChapter>): Promise<Chapter | null> {
    const [updated] = await db
      .update(chapters)
      .set(updates)
      .where(eq(chapters.id, chapterId))
      .returning();
    return updated || null;
  }

  async deleteChapter(chapterId: number): Promise<void> {
    // Get the chapter first to update journey's total count
    const chapter = await this.getChapterById(chapterId);
    if (chapter) {
      await db.delete(chapters).where(eq(chapters.id, chapterId));

      // Decrement journey's total chapters count
      await db
        .update(journeys)
        .set({
          totalChapters: sql`GREATEST(${journeys.totalChapters} - 1, 0)`,
          updatedAt: sql`now()`
        })
        .where(eq(journeys.id, chapter.journeyId));
    }
  }

  async getAllJourneys(): Promise<Journey[]> {
    // Returns all journeys (including unpublished) for admin view
    return await db.query.journeys.findMany({
      orderBy: [desc(journeys.createdAt)]
    });
  }

  async getAllJourneysWithChapters(): Promise<Array<Journey & { chapters: Chapter[] }>> {
    // Returns all journeys with their chapters for admin view
    const allJourneys = await db.query.journeys.findMany({
      orderBy: [desc(journeys.createdAt)]
    });

    const result = await Promise.all(
      allJourneys.map(async (journey) => {
        const journeyChapters = await db.query.chapters.findMany({
          where: eq(chapters.journeyId, journey.id),
          orderBy: [asc(chapters.chapterNumber)]
        });
        return { ...journey, chapters: journeyChapters };
      })
    );

    return result;
  }

  // ============================================
  // Phase 1: Conversation Starters (Always Available from DB)
  // ============================================
  async getConversationStarters(email: string): Promise<ConversationStarters> {
    // Get wine scores for analysis
    const wineScoresData = await this.getUserWineScores(email);
    const wines = wineScoresData?.scores || [];

    // Quick facts
    const totalWines = wines.length;
    const avgRating = totalWines > 0
      ? wines.reduce((sum: number, w: any) => sum + (w.averageScore || 0), 0) / totalWines
      : 0;

    // Determine preferred style based on ratings
    const redWines = wines.filter((w: any) => w.wineType === 'red');
    const whiteWines = wines.filter((w: any) => w.wineType === 'white');
    const avgRedRating = redWines.length > 0
      ? redWines.reduce((sum: number, w: any) => sum + (w.averageScore || 0), 0) / redWines.length
      : 0;
    const avgWhiteRating = whiteWines.length > 0
      ? whiteWines.reduce((sum: number, w: any) => sum + (w.averageScore || 0), 0) / whiteWines.length
      : 0;

    let preferredStyle = "Exploring";
    if (avgRedRating > avgWhiteRating + 0.3) preferredStyle = "Bold reds";
    else if (avgWhiteRating > avgRedRating + 0.3) preferredStyle = "Crisp whites";
    else if (totalWines > 0) preferredStyle = "Well-balanced";

    // Calculate favorite region with scores
    const regionStats = new Map<string, { count: number; totalScore: number }>();
    wines.forEach((wine: any) => {
      if (wine.region) {
        const stats = regionStats.get(wine.region) || { count: 0, totalScore: 0 };
        stats.count++;
        stats.totalScore += wine.averageScore || 0;
        regionStats.set(wine.region, stats);
      }
    });

    let favoriteRegion: ConversationStarters['favoriteRegion'] = null;
    if (regionStats.size > 0) {
      // Sort by avg rating first, then by count
      const sortedRegions = Array.from(regionStats.entries())
        .map(([region, stats]) => ({
          region,
          count: stats.count,
          avgRating: stats.totalScore / stats.count
        }))
        .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

      const top = sortedRegions[0];
      favoriteRegion = {
        region: top.region,
        wines: top.count,
        avgRating: Math.round(top.avgRating * 10) / 10,
        suggestion: `I've been exploring ${top.region} wines lately`
      };
    }

    // Calculate favorite grape with scores
    const grapeStats = new Map<string, { count: number; totalScore: number }>();
    wines.forEach((wine: any) => {
      if (wine.grapeVarietals && Array.isArray(wine.grapeVarietals)) {
        wine.grapeVarietals.forEach((grape: string) => {
          const stats = grapeStats.get(grape) || { count: 0, totalScore: 0 };
          stats.count++;
          stats.totalScore += wine.averageScore || 0;
          grapeStats.set(grape, stats);
        });
      }
    });

    let favoriteGrape: ConversationStarters['favoriteGrape'] = null;
    if (grapeStats.size > 0) {
      const sortedGrapes = Array.from(grapeStats.entries())
        .map(([grape, stats]) => ({
          grape,
          count: stats.count,
          avgRating: stats.totalScore / stats.count
        }))
        .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

      const top = sortedGrapes[0];
      favoriteGrape = {
        grape: top.grape,
        wines: top.count,
        avgRating: Math.round(top.avgRating * 10) / 10,
        suggestion: `I'm really into ${top.grape} right now`
      };
    }

    // Find signature wines (top-rated red and white)
    const topRed = redWines
      .filter((w: any) => w.averageScore > 0)
      .sort((a: any, b: any) => (b.averageScore || 0) - (a.averageScore || 0))[0];

    const topWhite = whiteWines
      .filter((w: any) => w.averageScore > 0)
      .sort((a: any, b: any) => (b.averageScore || 0) - (a.averageScore || 0))[0];

    const signatureWines: ConversationStarters['signatureWines'] = {
      red: topRed ? {
        name: topRed.wineName,
        region: topRed.region || 'Unknown region',
        rating: Math.round((topRed.averageScore || 0) * 10) / 10,
        description: this.generateWineDescription(topRed)
      } : null,
      white: topWhite ? {
        name: topWhite.wineName,
        region: topWhite.region || 'Unknown region',
        rating: Math.round((topWhite.averageScore || 0) * 10) / 10,
        description: this.generateWineDescription(topWhite)
      } : null
    };

    return {
      favoriteRegion,
      favoriteGrape,
      signatureWines,
      quickFacts: {
        totalWines,
        avgRating: Math.round(avgRating * 10) / 10,
        preferredStyle
      }
    };
  }

  // Helper to generate a brief wine description
  private generateWineDescription(wine: any): string {
    const parts: string[] = [];

    if (wine.grapeVarietals && wine.grapeVarietals.length > 0) {
      parts.push(wine.grapeVarietals[0]);
    }

    if (wine.region) {
      parts.push(`from ${wine.region}`);
    }

    if (wine.vintage) {
      parts.push(`(${wine.vintage})`);
    }

    if (parts.length === 0) {
      return "A wine you rated highly";
    }

    return parts.join(' ');
  }

  // ============================================
  // Phase 2: Explore Recommendations ("You Liked → Try Next")
  // ============================================
  async getExploreRecommendations(email: string, type: 'region' | 'grape' = 'region'): Promise<ExploreRecommendation[]> {
    // Import recommendation service dynamically to avoid circular deps
    const {
      getAllRegionRecommendations,
      getAllGrapeRecommendations,
      generateGPTRecommendation
    } = await import('./services/wineRecommendations');

    // Get wine scores for analysis
    const wineScoresData = await this.getUserWineScores(email);
    const wines = wineScoresData?.scores || [];

    if (wines.length === 0) {
      return [];
    }

    if (type === 'region') {
      return this.getRegionExploreRecommendations(wines, getAllRegionRecommendations, generateGPTRecommendation);
    } else {
      return this.getGrapeExploreRecommendations(wines, getAllGrapeRecommendations, generateGPTRecommendation);
    }
  }

  private async getRegionExploreRecommendations(
    wines: any[],
    getAllRegionRecommendations: any,
    generateGPTRecommendation: any
  ): Promise<ExploreRecommendation[]> {
    // Group wines by region and calculate stats
    const regionStats = new Map<string, {
      count: number;
      totalScore: number;
      descriptors: Set<string>;
    }>();

    wines.forEach((wine: any) => {
      if (!wine.region) return;

      const stats = regionStats.get(wine.region) || {
        count: 0,
        totalScore: 0,
        descriptors: new Set<string>()
      };

      stats.count++;
      stats.totalScore += wine.averageScore || 0;

      // Collect descriptors from grape varietals
      if (wine.grapeVarietals && Array.isArray(wine.grapeVarietals)) {
        wine.grapeVarietals.forEach((g: string) => stats.descriptors.add(g));
      }

      regionStats.set(wine.region, stats);
    });

    // Convert to LikedWine array, sorted by avg rating
    const likedRegions: LikedWine[] = Array.from(regionStats.entries())
      .map(([region, stats]) => ({
        name: region,
        region,
        avgRating: Math.round((stats.totalScore / stats.count) * 10) / 10,
        descriptors: Array.from(stats.descriptors).slice(0, 3),
        wineCount: stats.count
      }))
      .filter(r => r.avgRating >= 3.5) // Only recommend based on wines they liked
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3); // Top 3 regions

    // Get static recommendations
    const recommendations = getAllRegionRecommendations(likedRegions);

    // For regions without static mappings, try GPT
    const missingRecommendations = likedRegions.filter(
      liked => !recommendations.some((r: ExploreRecommendation) => r.likedWine.region === liked.region)
    );

    for (const liked of missingRecommendations.slice(0, 2)) { // Limit GPT calls
      const gptRec = await generateGPTRecommendation(liked, 'region');
      if (gptRec) {
        recommendations.push({
          likedWine: liked,
          tryNext: gptRec,
          type: 'region' as const
        });
      }
    }

    return recommendations.slice(0, 3); // Return top 3
  }

  private async getGrapeExploreRecommendations(
    wines: any[],
    getAllGrapeRecommendations: any,
    generateGPTRecommendation: any
  ): Promise<ExploreRecommendation[]> {
    // Group wines by grape and calculate stats
    const grapeStats = new Map<string, {
      count: number;
      totalScore: number;
      descriptors: Set<string>;
    }>();

    wines.forEach((wine: any) => {
      if (!wine.grapeVarietals || !Array.isArray(wine.grapeVarietals)) return;

      wine.grapeVarietals.forEach((grape: string) => {
        const stats = grapeStats.get(grape) || {
          count: 0,
          totalScore: 0,
          descriptors: new Set<string>()
        };

        stats.count++;
        stats.totalScore += wine.averageScore || 0;

        // Add region as descriptor
        if (wine.region) {
          stats.descriptors.add(wine.region);
        }

        grapeStats.set(grape, stats);
      });
    });

    // Convert to LikedWine array, sorted by avg rating
    const likedGrapes: LikedWine[] = Array.from(grapeStats.entries())
      .map(([grape, stats]) => ({
        name: grape,
        grape,
        avgRating: Math.round((stats.totalScore / stats.count) * 10) / 10,
        descriptors: Array.from(stats.descriptors).slice(0, 3),
        wineCount: stats.count
      }))
      .filter(g => g.avgRating >= 3.5) // Only recommend based on wines they liked
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3); // Top 3 grapes

    // Get static recommendations
    const recommendations = getAllGrapeRecommendations(likedGrapes);

    // For grapes without static mappings, try GPT
    const missingRecommendations = likedGrapes.filter(
      liked => !recommendations.some((r: ExploreRecommendation) => r.likedWine.grape === liked.grape)
    );

    for (const liked of missingRecommendations.slice(0, 2)) { // Limit GPT calls
      const gptRec = await generateGPTRecommendation(liked, 'grape');
      if (gptRec) {
        recommendations.push({
          likedWine: liked,
          tryNext: gptRec,
          type: 'grape' as const
        });
      }
    }

    return recommendations.slice(0, 3); // Return top 3
  }

  // ============================================
  // Phase 4: Journey Recommendations
  // ============================================
  async getJourneyRecommendations(email: string): Promise<JourneyRecommendationsResponse> {
    // 1. Get user's taste preferences
    const userWineScores = await this.getUserWineScores(email);
    const user = await this.getUserByEmail(email);
    const tastingLevel = user?.tastingLevel || 'intro';

    // Aggregate preferences from wine scores
    const regionCounts = new Map<string, { count: number; totalScore: number }>();
    const grapeCounts = new Map<string, { count: number; totalScore: number }>();
    let redCount = 0, whiteCount = 0, redTotalScore = 0, whiteTotalScore = 0;

    for (const wine of userWineScores.scores || []) {
      const score = wine.averageScore || 0;

      // Track wine type preference
      if (wine.wineType === 'red') {
        redCount++;
        redTotalScore += score;
      } else if (wine.wineType === 'white') {
        whiteCount++;
        whiteTotalScore += score;
      }

      // Track region preferences
      if (wine.region) {
        const existing = regionCounts.get(wine.region) || { count: 0, totalScore: 0 };
        existing.count++;
        existing.totalScore += score;
        regionCounts.set(wine.region, existing);
      }

      // Track grape preferences
      const grapes = wine.grapeVarietals as string[] || [];
      for (const grape of grapes) {
        const existing = grapeCounts.get(grape) || { count: 0, totalScore: 0 };
        existing.count++;
        existing.totalScore += score;
        grapeCounts.set(grape, existing);
      }
    }

    // Determine wine type preference
    const redAvg = redCount > 0 ? redTotalScore / redCount : 0;
    const whiteAvg = whiteCount > 0 ? whiteTotalScore / whiteCount : 0;
    let preferredWineType: 'red' | 'white' | 'balanced' = 'balanced';
    if (redAvg > whiteAvg + 0.5) preferredWineType = 'red';
    else if (whiteAvg > redAvg + 0.5) preferredWineType = 'white';

    // Get top regions and grapes (sorted by avg score, minimum 2 tastings)
    const topRegions = Array.from(regionCounts.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .map(([name, stats]) => ({ name, avgScore: stats.totalScore / stats.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(r => r.name);

    const topGrapes = Array.from(grapeCounts.entries())
      .filter(([_, stats]) => stats.count >= 2)
      .map(([name, stats]) => ({ name, avgScore: stats.totalScore / stats.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(g => g.name);

    // 2. Get all published journeys
    const allJourneys = await this.getPublishedJourneys();

    // 3. Get user's journeys (to exclude completed ones)
    const userJourneysList = user ? await db
      .select()
      .from(userJourneys)
      .where(eq(userJourneys.userId, user.id)) : [];

    const completedJourneyIds = new Set(
      userJourneysList
        .filter(uj => uj.completedAt !== null)
        .map(uj => uj.journeyId)
    );
    const inProgressJourneyIds = new Set(
      userJourneysList
        .filter(uj => uj.completedAt === null)
        .map(uj => uj.journeyId)
    );

    // 4. Score each journey
    const scoredJourneys: JourneyMatch[] = allJourneys
      .filter(journey => !completedJourneyIds.has(journey.id)) // Exclude completed
      .map(journey => {
        let matchScore = 50; // Base score
        const matchReasons: string[] = [];

        // Wine type alignment (+20 points for match)
        if (journey.wineType) {
          if (journey.wineType === preferredWineType) {
            matchScore += 20;
            matchReasons.push(`Matches your love of ${preferredWineType} wines`);
          } else if (journey.wineType === 'mixed') {
            matchScore += 10;
            matchReasons.push('Explore both red and white wines');
          }
        }

        // Difficulty alignment (+15 points for match)
        const difficultyMap: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
        const levelMap: Record<string, number> = { intro: 1, intermediate: 2, advanced: 3 };
        const journeyDiff = difficultyMap[journey.difficultyLevel] || 1;
        const userLevel = levelMap[tastingLevel] || 1;

        if (journeyDiff === userLevel) {
          matchScore += 15;
          matchReasons.push('Perfect for your current level');
        } else if (journeyDiff === userLevel + 1) {
          matchScore += 10;
          matchReasons.push('A great next step in your journey');
        } else if (journeyDiff > userLevel + 1) {
          matchScore -= 10;
        }

        // In-progress journeys get priority
        if (inProgressJourneyIds.has(journey.id)) {
          matchScore += 25;
          matchReasons.unshift('Continue where you left off');
        }

        // Add a reason if no specific matches found
        if (matchReasons.length === 0) {
          matchReasons.push('Discover something new');
        }

        return {
          journeyId: journey.id,
          title: journey.title,
          description: journey.description,
          difficultyLevel: journey.difficultyLevel,
          wineType: journey.wineType,
          totalChapters: journey.totalChapters,
          coverImageUrl: journey.coverImageUrl,
          matchScore: Math.min(100, Math.max(0, matchScore)),
          matchReasons
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5); // Top 5 recommendations

    return {
      recommendations: scoredJourneys,
      userPreferences: {
        preferredWineType,
        topRegions,
        topGrapes,
        tastingLevel
      }
    };
  }

  // ============================================
  // SOMMELIER CHAT METHODS
  // ============================================

  async getActiveSommelierChat(userId: number): Promise<SommelierChat | undefined> {
    const chat = await db.query.sommelierChats.findFirst({
      where: eq(sommelierChats.userId, userId),
      orderBy: [desc(sommelierChats.updatedAt)]
    });
    return chat;
  }

  async createSommelierChat(chat: InsertSommelierChat): Promise<SommelierChat> {
    const [newChat] = await db.insert(sommelierChats).values(chat).returning();
    return newChat;
  }

  async getSommelierChatMessages(chatId: number, limit: number = 20): Promise<SommelierMessage[]> {
    const messages = await db
      .select()
      .from(sommelierMessages)
      .where(eq(sommelierMessages.chatId, chatId))
      .orderBy(desc(sommelierMessages.createdAt))
      .limit(limit);
    return messages.reverse();
  }

  async createSommelierMessage(message: InsertSommelierMessage): Promise<SommelierMessage> {
    return db.transaction(async (tx) => {
      const [newMessage] = await tx.insert(sommelierMessages).values(message).returning();
      await tx
        .update(sommelierChats)
        .set({
          messageCount: sql`${sommelierChats.messageCount} + 1`,
          updatedAt: sql`now()`
        })
        .where(eq(sommelierChats.id, message.chatId));
      return newMessage;
    });
  }

  async updateSommelierChat(chatId: number, data: Partial<{ title: string; summary: string; lastSummaryAt: Date | string; messageCount: number; updatedAt: Date | string }>): Promise<void> {
    const setData: Record<string, any> = { ...data };
    if (setData.lastSummaryAt instanceof Date) setData.lastSummaryAt = setData.lastSummaryAt.toISOString();
    if (setData.updatedAt instanceof Date) setData.updatedAt = setData.updatedAt.toISOString();
    await db
      .update(sommelierChats)
      .set(setData)
      .where(eq(sommelierChats.id, chatId));
  }

  async archiveSommelierChat(chatId: number): Promise<void> {
    await db
      .update(sommelierChats)
      .set({ updatedAt: sql`now()` })
      .where(eq(sommelierChats.id, chatId));
  }

  async getUncompactedMessages(chatId: number, keepRecent: number = 10): Promise<SommelierMessage[]> {
    const allMessages = await db
      .select()
      .from(sommelierMessages)
      .where(eq(sommelierMessages.chatId, chatId))
      .orderBy(asc(sommelierMessages.createdAt));

    const uncompacted = allMessages.filter(m => {
      const meta = m.metadata as any;
      return !meta?.compacted;
    });

    if (uncompacted.length <= keepRecent) return [];
    return uncompacted.slice(0, uncompacted.length - keepRecent);
  }

  async markMessagesCompacted(messageIds: number[]): Promise<void> {
    if (messageIds.length === 0) return;
    await db
      .update(sommelierMessages)
      .set({
        metadata: sql`COALESCE(${sommelierMessages.metadata}, '{}'::jsonb) || '{"compacted": true}'::jsonb`
      })
      .where(inArray(sommelierMessages.id, messageIds));
  }

  async getUserSommelierChats(userId: number): Promise<SommelierChat[]> {
    return db
      .select()
      .from(sommelierChats)
      .where(and(
        eq(sommelierChats.userId, userId),
        gt(sommelierChats.messageCount, 0)
      ))
      .orderBy(desc(sommelierChats.updatedAt));
  }

  async getSommelierChatById(chatId: number, userId: number): Promise<SommelierChat | undefined> {
    return db.query.sommelierChats.findFirst({
      where: and(
        eq(sommelierChats.id, chatId),
        eq(sommelierChats.userId, userId)
      )
    });
  }

  async deleteSommelierChat(chatId: number): Promise<void> {
    await db.delete(sommelierChats).where(eq(sommelierChats.id, chatId));
  }

  // AI Response Cache methods
  async getTastingFingerprint(email: string): Promise<string> {
    // Solo tasting stats
    const user = await this.getUserByEmail(email);
    let soloCount = 0;
    let soloLatest = '';
    if (user) {
      const soloStats = await db.select({
        count: sql<number>`count(*)`,
        latest: sql<string>`coalesce(max(${tastings.tastedAt})::text, '')`
      }).from(tastings).where(eq(tastings.userId, user.id));
      soloCount = Number(soloStats[0]?.count ?? 0);
      soloLatest = soloStats[0]?.latest ?? '';
    }

    // Group tasting stats
    const groupStats = await db.select({
      count: sql<number>`count(*)`,
      latest: sql<string>`coalesce(max(${participants.createdAt})::text, '')`
    }).from(participants).where(eq(participants.email, email));
    const groupCount = Number(groupStats[0]?.count ?? 0);
    const groupLatest = groupStats[0]?.latest ?? '';

    return `${soloCount}-${soloLatest}-${groupCount}-${groupLatest}`;
  }

  async getAiResponseCache(email: string, cacheKey: string): Promise<AiResponseCache | undefined> {
    const result = await db.query.aiResponseCache.findFirst({
      where: and(
        eq(aiResponseCache.userEmail, email),
        eq(aiResponseCache.cacheKey, cacheKey)
      )
    });
    return result ?? undefined;
  }

  async setAiResponseCache(email: string, cacheKey: string, fingerprint: string, responseData: any): Promise<void> {
    await db
      .insert(aiResponseCache)
      .values({
        userEmail: email,
        cacheKey,
        fingerprint,
        responseData,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [aiResponseCache.userEmail, aiResponseCache.cacheKey],
        set: {
          fingerprint,
          responseData,
          updatedAt: new Date()
        }
      });
  }
}

// LLM Integration Function for Sommelier Tips
export async function generateSommelierTips(email: string): Promise<SommelierTips> {
  try {
    console.log(`🍷 Generating sommelier tips for: ${email}`);

    // 1. Get user's wine preferences from their responses
    const userDashboardData = await storage.getUserDashboardData(email);
    const userWineScores = await storage.getUserWineScores(email);

    // Get user's tasting level for personalized insights
    const user = await storage.getUserByEmail(email);
    const userLevel = user?.tastingLevel || 'intro';

    // 2. Get sommelier feedback from previous tasting sessions
    const sommelierFeedback = await storage.getUserSommelierFeedback(email);
    
    if (!userDashboardData || !userWineScores.scores || userWineScores.scores.length === 0) {
      console.log(`📝 No tasting history found for ${email}, returning default tips`);
      // Return default tips for users with no tasting history
      return {
        preferenceProfile: "I'm new to wine tasting and looking to explore different styles and regions.",
        redDescription: "I'm interested in learning about red wines and discovering my preferences.",
        whiteDescription: "I'd like to explore white wines and understand their characteristics.",
        questions: [
          "What wines would you recommend for someone just starting their wine journey?",
          "Could you suggest a good wine for food pairing with [your dish]?",
          "What's a good value wine that would help me develop my palate?",
          "Can you recommend wines from different regions to help me explore?"
        ],
        priceGuidance: "I'm looking for wines in the $20-40 range as I develop my palate and preferences."
      };
    }

    // 2. Aggregate their top regions, grapes, and average ratings
    const topRegion = userDashboardData.topPreferences?.topRegion?.name || "various regions";
    const topGrape = userDashboardData.topPreferences?.topGrape?.name || "different grape varieties";
    const avgRating = userDashboardData.stats?.averageScore || 3.5;
    
    // Get wine type preferences
    const redWines = userWineScores.scores.filter((wine: any) => wine.wineType === 'red');
    const whiteWines = userWineScores.scores.filter((wine: any) => wine.wineType === 'white');
    const totalWines = userWineScores.scores.length;

    // Get top-rated white and red wines with traits
    const topWhiteWine = whiteWines
      .sort((a: any, b: any) => b.averageScore - a.averageScore)[0];
    const topRedWine = redWines
      .sort((a: any, b: any) => b.averageScore - a.averageScore)[0];

    const topWhite = topWhiteWine
      ? `${topWhiteWine.wineName} from ${topWhiteWine.region || 'unknown region'} (${topWhiteWine.averageScore}/5) - ${topWhiteWine.grapeVarietals?.join(', ') || 'grape variety unknown'}`
      : 'No white wines rated yet';

    const topRed = topRedWine
      ? `${topRedWine.wineName} from ${topRedWine.region || 'unknown region'} (${topRedWine.averageScore}/5) - ${topRedWine.grapeVarietals?.join(', ') || 'grape variety unknown'}`
      : 'No red wines rated yet';

    console.log(`📊 User profile: ${totalWines} wines, ${avgRating.toFixed(1)}/5 avg, ${topRegion}, ${topGrape}`);
    console.log(`🍷 Sommelier feedback entries: ${sommelierFeedback.length}`);

    // Step 1: Load the prompt template
    try {
      const templatePath = path.join(process.cwd(), 'prompts', 'taste_helper.txt');
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      // Step 2: Replace placeholders with user data
      const MAX_TOKENS = 128000; // gpt-4o → 128k tokens max
      let prompt = templateContent
        .replace('{userLevel}', userLevel)
        .replace('{totalWines}', totalWines.toString())
        .replace('{avgRating}', avgRating.toFixed(1))
        .replace('{topRegion}', topRegion)
        .replace('{topGrape}', topGrape)
        .replace('{topWhite}', topWhite)
        .replace('{topRed}', topRed)

        let feedback = [...sommelierFeedback];
        let feedbackText = feedback.map((f, i) => `\n  ${i + 1}. ${f}`).join('');

        while (feedback.length && (prompt.length + feedbackText.length) / 4 >= MAX_TOKENS) {
          feedback.shift();
          feedbackText = feedback.map((f, i) => `\n  ${i + 1}. ${f}`).join('');
        }

        prompt = prompt.replace('{sommelierFeedback}', feedback.length ? feedbackText : 'No feedback available');
        console.log(`🔍 ≈${(prompt.length / 4).toFixed(0)} tokens, ${feedback.length}/${sommelierFeedback.length} feedback`);

      console.log(`📋 Template loaded and populated successfully`);

      // Step 3: Call OpenAI GPT-4o API
      if (!openai || !process.env.OPENAI_API_KEY) {
        console.warn("⚠️  OpenAI not configured - returning default tips");
        return {
          preferenceProfile: "AI-powered preference analysis is not available. Please configure OPENAI_API_KEY.",
          redDescription: "Red wine preference analysis unavailable.",
          whiteDescription: "White wine preference analysis unavailable.",
          questions: ["What wine would you recommend?", "Can you suggest a food pairing?"],
          priceGuidance: "Wine recommendations unavailable without AI analysis."
        };
      }

      console.log(`🤖 Calling OpenAI API...`);
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2", // Using GPT-5.2 for quality sommelier tips
        messages: [
          {
            role: "system",
            content: `You are a friendly sommelier helping someone feel confident about wine. Your job is to give them memorable things they can say that make them sound knowledgeable to friends - not to experts, just to normal people.

Give them:
- A wine identity they can claim ("I'm a bold red person")
- ONE grape for red, ONE grape for white they can call "theirs"
- Simple phrases they can actually say at a wine shop or restaurant
- Practical price guidance

Write in second person (you/your). Sound like a knowledgeable friend, not a lecturer.
Make every insight feel like a revelation, even if they've only done one tasting.
Never hedge with "limited data" or "need more tastings" - treat their choices as meaningful signals.

Respond ONLY with JSON in this exact format:
{
  "wineArchetype": "2-3 word memorable identity (e.g., Bold Explorer, Elegant Traditionalist)",
  "preferenceProfile": "2-3 sentences describing their palate like a wine-savvy friend would",
  "redDescription": "their red wine identity + one grape + one region + what to say",
  "whiteDescription": "their white wine identity + one grape + one region + what to say",
  "questions": ["natural phrase 1", "natural phrase 2", "natural phrase 3", "natural phrase 4"],
  "priceGuidance": "simple, practical price advice"
}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 600,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error("OpenAI returned empty response");
      }

      console.log(`✅ OpenAI response received (${response.length} chars)`);

      // Step 4: Parse the JSON response directly
      const jsonResponse = JSON.parse(response);
      const parsedTips = validateAndSanitizeSommelierTips(jsonResponse, {
        topRegion,
        topGrape,
        avgRating,
        redWines,
        whiteWines,
        totalWines
      });

      console.log(`🎯 Successfully generated personalized sommelier tips for ${email}`);
      return parsedTips;

    } catch (templateError) {
      console.error("Template loading error:", templateError);
      throw new Error(`Failed to load or process template: ${templateError instanceof Error ? templateError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error("Error in generateSommelierTips:", error);
    
    // Step 6: Enhanced Error Handling - Categorize errors and provide appropriate fallbacks
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY')) {
        console.error("❌ OpenAI API key not configured");
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        console.error("❌ OpenAI API quota/rate limit exceeded");
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error("❌ Network error connecting to OpenAI");
      } else if (error.message.includes('template')) {
        console.error("❌ Template file error");
      } else {
        console.error("❌ Unexpected error:", error.message);
      }
    }
    
    // Always provide fallback tips
    console.log(`🔄 Falling back to static tips for ${email}`);
    return generateFallbackTips(email);
  }
}



// Validate and sanitize JSON response from OpenAI
function validateAndSanitizeSommelierTips(jsonResponse: any, context: any): SommelierTips {
  // Generate fallback archetype based on preferences
  let fallbackArchetype = "Wine Explorer";
  if (context.redWines > context.whiteWines * 2) {
    fallbackArchetype = "Bold Enthusiast";
  } else if (context.whiteWines > context.redWines * 2) {
    fallbackArchetype = "Crisp Connoisseur";
  } else if (context.totalWines > 10) {
    fallbackArchetype = "Curious Wanderer";
  }

  return {
    wineArchetype: jsonResponse.wineArchetype || fallbackArchetype,
    preferenceProfile: jsonResponse.preferenceProfile || `I enjoy wines from ${context.topRegion}, particularly ${context.topGrape}. My average rating is ${context.avgRating.toFixed(1)}/5.`,
    redDescription: jsonResponse.redDescription || "I'm interested in exploring red wines and understanding their characteristics.",
    whiteDescription: jsonResponse.whiteDescription || "I'd like to explore white wines and discover my preferences.",
    questions: Array.isArray(jsonResponse.questions) ? jsonResponse.questions.slice(0, 4) : [
      `Do you have any wines similar to ${context.topGrape} from ${context.topRegion}?`,
      "What would you recommend that pairs well with my meal?",
      "Can you suggest something from a region I haven't explored?",
      "What's a good value wine that represents the style I enjoy?"
    ],
    priceGuidance: jsonResponse.priceGuidance || `I typically enjoy wines in the $${Math.round(context.avgRating * 20)}-${Math.round(context.avgRating * 30)} range.`
  };
}

// Fallback function if OpenAI is unavailable
function generateFallbackTips(email: string): SommelierTips {
  return {
    wineArchetype: "Wine Explorer",
    preferenceProfile: "I'm developing my wine palate and enjoy exploring different styles and regions to understand my preferences better.",
    redDescription: "I'm interested in red wines with good balance and approachable tannins.",
    whiteDescription: "I enjoy white wines that are crisp and refreshing with good acidity.",
    questions: [
      "What wines would you recommend based on my developing palate?",
      "Could you suggest a wine that pairs well with my meal?",
      "What's a good value wine that would help me explore new regions?",
      "Do you have any recommendations for wines similar to ones I've enjoyed?"
    ],
    priceGuidance: "I'm looking for wines in the $25-50 range that offer good quality and help me develop my wine knowledge."
  };
}

export const storage = new DatabaseStorage();
