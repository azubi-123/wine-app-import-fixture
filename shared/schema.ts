import { pgTable, text, serial, uuid, integer, boolean, timestamp, jsonb, varchar, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sommeliers table for multi-tenant authentication
export const sommeliers = pgTable("sommeliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  emailIdx: index("idx_sommeliers_email").on(table.email)
}));

// Wine characteristics table for tracking attributes
export const wineCharacteristics = pgTable("wine_characteristics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull(), // 'structure', 'flavor', 'aroma', etc.
  description: text("description"),
  scaleType: varchar("scale_type", { length: 20 }).notNull(), // 'numeric', 'descriptive', 'boolean'
  scaleMin: integer("scale_min"),
  scaleMax: integer("scale_max"),
  scaleLabels: jsonb("scale_labels"), // Array of label options
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  categoryIdx: index("idx_wine_characteristics_category").on(table.category)
}));

// Slide templates for reusable question patterns
export const slideTemplates = pgTable("slide_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  sommelierId: uuid("sommelier_id"),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(),
  sectionType: varchar("section_type", { length: 20 }),
  payloadTemplate: jsonb("payload_template").notNull(),
  isPublic: boolean("is_public").default(false), // Can be used by other sommeliers
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  typeIdx: index("idx_slide_templates_type").on(table.type)
}));

// Packages table with sommelier ownership
export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sommelierId: uuid("sommelier_id"),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(false), // Can be viewed/used by other sommeliers
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  codeIdx: index("idx_packages_code").on(table.code)
}));

// Package wines table with enhanced tracking capabilities
export const packageWines = pgTable("package_wines", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").notNull().references(() => packages.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  wineName: text("wine_name").notNull(),
  wineDescription: text("wine_description"),
  wineImageUrl: text("wine_image_url"),
  // Wine Analytics Attributes
  wineType: varchar("wine_type", { length: 50 }), // 'red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'orange'
  vintage: integer("vintage"),
  region: text("region"),
  producer: text("producer"),
  grapeVarietals: jsonb("grape_varietals"), // Array of grape varieties
  alcoholContent: text("alcohol_content"), // e.g., "13.5%"
  // Expected characteristics for analytics comparison
  expectedCharacteristics: jsonb("expected_characteristics"), // Sommelier's expected ratings
  // Discussion questions for wine tasting
  discussionQuestions: jsonb("discussion_questions").default([]), // Array of discussion questions
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  uniquePosition: unique().on(table.packageId, table.position),
  wineTypeIdx: index("idx_package_wines_type").on(table.wineType),
  vintageIdx: index("idx_package_wines_vintage").on(table.vintage)
}));

// Wine response analytics for tracking user accuracy
export const wineResponseAnalytics = pgTable("wine_response_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageWineId: uuid("package_wine_id").notNull().references(() => packageWines.id, { onDelete: "cascade" }),
  characteristicName: varchar("characteristic_name", { length: 100 }).notNull(),
  expectedValue: text("expected_value"), // Sommelier's expected answer
  averageUserValue: text("average_user_value"), // Average user response
  accuracyScore: integer("accuracy_score"), // 0-100 percentage
  responseCount: integer("response_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow()
}, (table) => ({
  wineCharacteristicIdx: index("idx_wine_analytics_wine_char").on(table.packageWineId, table.characteristicName)
}));

// Define all allowed slide types
const slideTypes = ['question', 'media', 'interlude', 'video_message', 'audio_message', 'transition'] as const;

// Slides table - ALL content lives here, now linked to package wines
export const slides = pgTable("slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageWineId: uuid("package_wine_id").references(() => packageWines.id, { onDelete: "cascade" }), // Now nullable
  packageId: uuid("package_id").references(() => packages.id, { onDelete: "cascade" }), // New field for package-level slides
  position: integer("position").notNull(),
  globalPosition: integer("global_position").notNull().default(0),
  type: varchar("type", { length: 50 }).$type<typeof slideTypes[number]>().notNull(),
  section_type: varchar("section_type", { length: 20 }),
  payloadJson: jsonb("payload_json").notNull(),
  genericQuestions: jsonb("generic_questions"), // New generic questions format
  createdAt: timestamp("created_at").defaultNow(),
  comparable: boolean().default(false),
}, (table) => ({
  packageWinePositionIdx: index("idx_slides_package_wine_position").on(table.packageWineId, table.position),
  globalPositionIdx: index("idx_slides_global_position").on(table.packageWineId, table.globalPosition),
  packageWineIdx: index("idx_slides_package_wine_id").on(table.packageWineId),
  packageIdIdx: index("idx_slides_package_id").on(table.packageId)
}));

// Sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").references(() => packages.id, { onDelete: "cascade" }),
  short_code: varchar("short_code", { length: 8 }).unique(),
  status: varchar("status", { length: 20 }).default('waiting').notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  activeParticipants: integer("active_participants").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  packageIdIdx: index("idx_sessions_package_id").on(table.packageId),
  shortCodeIdx: index("idx_sessions_short_code").on(table.short_code)
}));

// Session Wine Selections - allows hosts to choose specific wines for their session
export const sessionWineSelections = pgTable("session_wine_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  packageWineId: uuid("package_wine_id").notNull().references(() => packageWines.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // Custom order set by host
  isIncluded: boolean("is_included").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  sessionIdIdx: index("idx_session_wines_session_id").on(table.sessionId),
  sessionPositionIdx: index("idx_session_wines_session_position").on(table.sessionId, table.position),
  uniqueSessionWine: index("idx_unique_session_wine").on(table.sessionId, table.packageWineId)
}));

// Participants table
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isHost: boolean("is_host").default(false),
  progressPtr: integer("progress_ptr").default(0),
  lastActive: timestamp("last_active").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  sommelier_feedback: text("sommelier_feedback"),
}, (table) => ({
  sessionIdx: index("idx_participants_session").on(table.sessionId),
  emailSessionIdx: index("idx_participants_email_session").on(table.email, table.sessionId)
}));

// Responses table
export const responses = pgTable("responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").references(() => participants.id, { onDelete: "cascade" }),
  slideId: uuid("slide_id").references(() => slides.id, { onDelete: "cascade" }),
  answerJson: jsonb("answer_json").notNull(),
  answeredAt: timestamp("answered_at").defaultNow(),
  synced: boolean("synced").default(true)
}, (table) => ({
  participantIdx: index("idx_responses_participant").on(table.participantId),
  syncedIdx: index("idx_responses_synced").on(table.synced),
  uniqueParticipantSlide: unique().on(table.participantId, table.slideId)
}));

// Media table for secure file references
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicId: varchar("public_id", { length: 12 }).notNull().unique(), // Public-facing ID
  sommelierId: uuid("sommelier_id"), // Owner
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'slide', 'wine', 'package'
  entityId: uuid("entity_id"), // Reference to the entity
  mediaType: varchar("media_type", { length: 20 }).notNull(), // 'video', 'audio', 'image'
  fileName: text("file_name").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  storageUrl: text("storage_url").notNull(), // Internal Supabase URL (never exposed)
  thumbnailUrl: text("thumbnail_url"), // For video/image thumbnails
  duration: integer("duration"), // For audio/video in seconds
  metadata: jsonb("metadata"), // Additional metadata
  isPublic: boolean("is_public").default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at")
}, (table) => ({
  publicIdIdx: index("idx_media_public_id").on(table.publicId),
  entityIdx: index("idx_media_entity").on(table.entityType, table.entityId),
  sommelierIdx: index("idx_media_sommelier").on(table.sommelierId)
}));

// Glossary terms table
export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  term: text("term").notNull().unique(),
  variations: text("variations").array(), // For alternate spellings
  definition: text("definition").notNull(),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  termIdx: index("idx_glossary_terms_term").on(table.term),
  categoryIdx: index("idx_glossary_terms_category").on(table.category)
}));

// Payload schemas for different slide types
export const videoMessagePayloadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  video_url: z.string().url({ message: "Invalid video URL" }).optional(), // Legacy support
  video_publicId: z.string().optional(), // New secure reference
  video_fileName: z.string().optional(),
  video_fileSize: z.number().optional(),
  poster_url: z.string().url({ message: "Invalid poster URL" }).optional(),
  autoplay: z.boolean().default(false).optional(),
  show_controls: z.boolean().default(true).optional()
});
export type VideoMessagePayload = z.infer<typeof videoMessagePayloadSchema>;

export const audioMessagePayloadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  audio_url: z.string().url({ message: "Invalid audio URL" }).optional(), // Legacy support
  audio_publicId: z.string().optional(), // New secure reference
  audio_fileName: z.string().optional(),
  audio_fileSize: z.number().optional(),
  autoplay: z.boolean().default(false).optional(),
  show_controls: z.boolean().default(true).optional()
});
export type AudioMessagePayload = z.infer<typeof audioMessagePayloadSchema>;

export const interludePayloadSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  wine_name: z.string().optional(),
  wine_image: z.string().url().optional()
});
export type InterludePayload = z.infer<typeof interludePayloadSchema>;

export const mediaPayloadSchema = z.object({
  image_url: z.string().url(),
  alt_text: z.string().optional(),
  title: z.string().optional()
});
export type MediaPayload = z.infer<typeof mediaPayloadSchema>;

export const transitionPayloadSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  backgroundImage: z.string().url().optional(),
  duration: z.number().default(2000), // Duration in ms
  showContinueButton: z.boolean().default(false),
  animation_type: z.enum(['wine_glass_fill', 'fade', 'slide']).default('wine_glass_fill')
});
export type TransitionPayload = z.infer<typeof transitionPayloadSchema>;

// Insert schemas
export const insertPackageSchema = createInsertSchema(packages, {
  description: z.string().nullable().optional(),
  sommelierId: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPackageWineSchema = createInsertSchema(packageWines, {
  wineDescription: z.string().nullable().optional(),
  wineImageUrl: z.string().nullable().optional(),
  position: z.number().optional() // Optional since it's calculated server-side
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSlideSchema = createInsertSchema(slides, {
  type: z.enum(slideTypes),
  section_type: z.enum(['intro', 'deep_dive', 'ending']).optional().nullable(),
  payloadJson: z.any(), // Accept any JSON payload, validation happens in application logic
  genericQuestions: z.object({
    format: z.enum(['multiple_choice', 'scale', 'text', 'boolean', 'ranking', 'matrix', 'video_message', 'audio_message']),
    config: z.object({
      title: z.string(),
      description: z.string().optional()
    }).passthrough(), // Allow additional format-specific fields
    metadata: z.object({
      tags: z.array(z.string()).optional(),
      category: z.enum(['appearance', 'aroma', 'taste', 'structure', 'overall', 'general']).optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
      estimatedTime: z.number().optional(),
      pointValue: z.number().optional(),
      expertNote: z.string().optional(),
      glossaryTerms: z.array(z.string()).optional(),
      relatedCharacteristics: z.array(z.string()).optional()
    }).optional(),
    validation: z.object({
      required: z.boolean().optional(),
      customValidation: z.object({
        rule: z.string(),
        message: z.string()
      }).optional(),
      dependencies: z.array(z.object({
        questionId: z.string(),
        condition: z.string()
      })).optional()
    }).optional()
  }).optional()
}).omit({
  id: true,
  createdAt: true
}).refine((data) => {
  // Ensure slides have either packageWineId OR packageId (but not both and not neither)
  const hasWineId = data.packageWineId !== null && data.packageWineId !== undefined;
  const hasPackageId = data.packageId !== null && data.packageId !== undefined;
  return (hasWineId && !hasPackageId) || (!hasWineId && hasPackageId);
}, {
  message: "Slide must belong to either a wine (packageWineId) or directly to a package (packageId), but not both"
});

export const insertSessionSchema = createInsertSchema(sessions, {
  packageId: z.string().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  activeParticipants: z.number().int().min(0).nullable().optional(),
  status: z.string().optional(),
  updatedAt: z.date().optional(),
  short_code: z.string().length(6, "Short code must be 6 characters").optional()
}).omit({
  id: true,
  startedAt: true
});

export const insertParticipantSchema = createInsertSchema(participants, {
  sessionId: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  isHost: z.boolean().nullable().optional(),
  progressPtr: z.number().nullable().optional()
}).omit({
  id: true,
  lastActive: true,
  createdAt: true
});

export const insertResponseSchema = createInsertSchema(responses, {
  participantId: z.string().nullable().optional(),
  slideId: z.string().nullable().optional(),
  synced: z.boolean().nullable().optional()
}).omit({
  id: true,
  answeredAt: true
});

export const insertGlossaryTermSchema = createInsertSchema(glossaryTerms, {
  variations: z.array(z.string()).nullable().optional(),
  category: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertSessionWineSelectionSchema = createInsertSchema(sessionWineSelections, {
  sessionId: z.string(),
  packageWineId: z.string(),
  position: z.number(),
  isIncluded: z.boolean().default(true)
}).omit({
  id: true,
  createdAt: true
});

export const insertMediaSchema = createInsertSchema(media, {
  publicId: z.string().min(8).max(12),
  sommelierId: z.string().nullable().optional(),
  entityType: z.enum(['slide', 'wine', 'package']),
  entityId: z.string().nullable().optional(),
  mediaType: z.enum(['video', 'audio', 'image']),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().min(0),
  storageUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  duration: z.number().min(0).nullable().optional(),
  metadata: z.any().nullable().optional(),
  isPublic: z.boolean().default(false).optional()
}).omit({
  id: true,
  uploadedAt: true,
  lastAccessedAt: true
});

// Types
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type PackageWine = typeof packageWines.$inferSelect;
export type InsertPackageWine = z.infer<typeof insertPackageWineSchema>;
export type Slide = typeof slides.$inferSelect;
export type InsertSlide = z.infer<typeof insertSlideSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type SessionWineSelection = typeof sessionWineSelections.$inferSelect;
export type InsertSessionWineSelection = z.infer<typeof insertSessionWineSelectionSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Response = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type Media = typeof media.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type InsertGlossaryTerm = z.infer<typeof insertGlossaryTermSchema>;

// Generic Questions Types
export type QuestionFormat = 'multiple_choice' | 'scale' | 'text' | 'boolean' | 'ranking' | 'matrix' | 'video_message' | 'audio_message';

export interface GenericQuestion {
  format: QuestionFormat;
  config: QuestionConfig;
  metadata?: QuestionMetadata;
  validation?: ValidationRules;
}

export interface QuestionConfig {
  title: string;
  description?: string;
  [key: string]: any; // Format-specific fields
}

export interface MultipleChoiceConfig extends QuestionConfig {
  options: Array<{
    id: string;
    text: string;
    value: string;
    description?: string;
    imageUrl?: string;
  }>;
  allowMultiple: boolean;
  allowOther?: boolean;
  otherLabel?: string;
  randomizeOptions?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface ScaleConfig extends QuestionConfig {
  scaleMin: number;
  scaleMax: number;
  scaleLabels: [string, string]; // [min label, max label]
  step?: number;
  showNumbers?: boolean;
  showLabels?: boolean;
  defaultValue?: number;
  visualStyle?: 'slider' | 'buttons' | 'stars';
}

export interface TextConfig extends QuestionConfig {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number; // for textarea
  inputType?: 'text' | 'textarea' | 'email' | 'number';
  pattern?: string; // regex validation
}

export interface BooleanConfig extends QuestionConfig {
  trueLabel?: string;  // default: "Yes"
  falseLabel?: string; // default: "No"
  defaultValue?: boolean;
  visualStyle?: 'buttons' | 'toggle' | 'checkbox';
}

export interface VideoMessageConfig extends QuestionConfig {
  video_url: string;
  duration?: number;
  thumbnail_url?: string;
  autoplay?: boolean;
  controls?: boolean;
}

export interface AudioMessageConfig extends QuestionConfig {
  audio_url: string;
  duration?: number;
  autoplay?: boolean;
  waveform_data?: string;
}

export interface QuestionMetadata {
  tags?: string[];
  category?: 'appearance' | 'aroma' | 'taste' | 'structure' | 'overall' | 'general';
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime?: number; // seconds
  pointValue?: number;
  expertNote?: string;
  glossaryTerms?: string[]; // auto-highlighted terms
  relatedCharacteristics?: string[]; // wine characteristic IDs
}

export interface ValidationRules {
  required?: boolean;
  customValidation?: {
    rule: string; // JS expression
    message: string;
  };
  dependencies?: Array<{
    questionId: string;
    condition: string; // JS expression
  }>;
}

export interface SommelierTips {
  wineArchetype?: string; // Phase 1: Wine identity (e.g., "Bold Explorer")
  preferenceProfile: string;
  redDescription: string;
  whiteDescription: string;
  questions: string[];
  priceGuidance: string;
}

// Phase 1: Always-available conversation starters from database
// These render immediately without waiting for GPT
export interface ConversationStarters {
  favoriteRegion: {
    region: string;
    wines: number;
    avgRating: number;
    suggestion: string;
  } | null;
  favoriteGrape: {
    grape: string;
    wines: number;
    avgRating: number;
    suggestion: string;
  } | null;
  signatureWines: {
    red: {
      name: string;
      region: string;
      rating: number;
      description: string;
    } | null;
    white: {
      name: string;
      region: string;
      rating: number;
      description: string;
    } | null;
  };
  quickFacts: {
    totalWines: number;
    avgRating: number;
    preferredStyle: string;
  };
}

// Phase 2: Explore recommendations - "You liked X → Try Y"
export interface LikedWine {
  name: string;
  region?: string;
  grape?: string;
  avgRating: number;
  descriptors: string[];
  wineCount: number;
}

export interface WineRecommendation {
  name: string;
  region?: string;
  whyYoullLikeIt: string;
  deeperExplanation: string;
}

export interface ExploreRecommendation {
  likedWine: LikedWine;
  tryNext: WineRecommendation;
  type: 'region' | 'grape';
}

// Phase 3: Producer recommendations by price tier (LLM-powered)
export interface ProducerRecommendation {
  producerName: string;
  wineName: string;
  estimatedPrice: string;
  grapeVariety: string;
  region: string;
  whyForYou: string;
  whereToBuy: string[];
  tastingNotes: string;
}

export interface ProducerRecommendationsResponse {
  recommendations: ProducerRecommendation[];
  priceDisclaimer: string;
  priceTier: 'budget' | 'mid' | 'premium';
  generatedAt: string;
}

// Phase 4: Journey recommendations based on taste preferences
export interface JourneyMatch {
  journeyId: number;
  title: string;
  description: string | null;
  difficultyLevel: string;
  wineType: string | null;
  totalChapters: number;
  coverImageUrl: string | null;
  matchScore: number; // 0-100
  matchReasons: string[]; // Why this journey fits the user
}

export interface JourneyRecommendationsResponse {
  recommendations: JourneyMatch[];
  userPreferences: {
    preferredWineType: 'red' | 'white' | 'balanced';
    topRegions: string[];
    topGrapes: string[];
    tastingLevel: string;
  };
}

// ============================================
// SOLO TASTING TABLES (Product Pivot - Sprint 1)
// ============================================

// Users table for solo tasters (email-only auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Tasting level progression
  tastingLevel: varchar("tasting_level", { length: 20 }).default('intro').notNull(), // 'intro', 'intermediate', 'advanced'
  tastingsCompleted: integer("tastings_completed").default(0).notNull(),
  levelUpPromptEligible: boolean("level_up_prompt_eligible").default(false).notNull(),
  // Phase 1: Wine archetype for identity (e.g., "Bold Explorer", "Elegant Traditionalist")
  wineArchetype: varchar("wine_archetype", { length: 100 }),
  // Onboarding quiz
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingData: jsonb("onboarding_data"), // OnboardingData blob
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email)
}));

// Auth attempts table for rate limiting
export const authAttempts = pgTable("auth_attempts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }) // IPv6 max length
}, (table) => ({
  emailIdx: index("idx_auth_attempts_email").on(table.email),
  ipIdx: index("idx_auth_attempts_ip").on(table.ipAddress),
  attemptedAtIdx: index("idx_auth_attempts_attempted_at").on(table.attemptedAt)
}));

// Solo tastings table (stores full questionnaire responses)
export const tastings = pgTable("tastings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wineName: varchar("wine_name", { length: 255 }).notNull(),
  wineRegion: varchar("wine_region", { length: 255 }),
  wineVintage: integer("wine_vintage"),
  grapeVariety: varchar("grape_variety", { length: 255 }),
  wineType: varchar("wine_type", { length: 50 }), // 'red', 'white', 'rosé', etc.
  photoUrl: text("photo_url"),
  tastedAt: timestamp("tasted_at").defaultNow().notNull(),
  responses: jsonb("responses").notNull(), // Full tasting questionnaire responses
  wineCharacteristics: jsonb("wine_characteristics"), // Baseline wine data from GPT-4
  recommendations: jsonb("recommendations") // AI-generated next bottle recommendations
}, (table) => ({
  userIdIdx: index("idx_tastings_user_id").on(table.userId),
  tastedAtIdx: index("idx_tastings_tasted_at").on(table.tastedAt),
  responsesIdx: index("idx_tastings_responses").using("gin", table.responses)
}));

// Insert schemas for solo tasting
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address").transform(e => e.toLowerCase())
}).omit({
  id: true,
  createdAt: true
});

export const insertAuthAttemptSchema = createInsertSchema(authAttempts, {
  email: z.string().email().transform(e => e.toLowerCase()),
  ipAddress: z.string().nullable().optional()
}).omit({
  id: true,
  attemptedAt: true
});

export const insertTastingSchema = createInsertSchema(tastings, {
  wineName: z.string().min(1, "Wine name is required"),
  wineRegion: z.string().nullable().optional(),
  wineVintage: z.number().int().min(1900).max(2100).nullable().optional(),
  grapeVariety: z.string().nullable().optional(),
  wineType: z.enum(['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'orange']).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  responses: z.record(z.any()) // JSONB object for tasting responses
}).omit({
  id: true,
  tastedAt: true
});

// Onboarding quiz answers
export interface OnboardingData {
  knowledgeLevel: 'beginner' | 'casual' | 'enthusiast' | 'nerd' | 'not_sure';
  wineVibe: 'bold' | 'light' | 'sweet' | 'adventurous' | 'not_sure';
  foodPreferences: string[];
  drinkPreferences: string[];
  occasion: 'learning' | 'go_to_bottle' | 'impress' | 'date_night' | 'not_sure';
  completedAt: string;
}

// Types for solo tasting
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AuthAttempt = typeof authAttempts.$inferSelect;
export type InsertAuthAttempt = z.infer<typeof insertAuthAttemptSchema>;
export type Tasting = typeof tastings.$inferSelect;
export type InsertTasting = z.infer<typeof insertTastingSchema>;

// Tasting responses structure (for type safety)
export interface TastingResponses {
  visual?: {
    clarity?: number;
    intensity?: number;
    color?: string;
    notes?: string;
  };
  aroma?: {
    intensity?: number;
    primaryAromas?: string[];
    secondaryAromas?: string[];
    notes?: string;
  };
  taste?: {
    sweetness?: number;
    acidity?: number;
    tannins?: number;
    body?: number;
    flavors?: string[];
    notes?: string;
  };
  structure?: {
    balance?: number;
    finish?: number;
    complexity?: number;
    notes?: string;
  };
  overall?: {
    rating?: number;
    wouldBuyAgain?: boolean | 'yes' | 'maybe' | 'no';
    notes?: string;
  };
  // Three-beat loop: preference signals from "rate" beats
  preferences?: {
    [characteristic: string]: {
      enjoyment: number; // 1-10: how much they liked this characteristic
      wantMore: boolean; // would they want more of this in future wines
    };
  };
}

// Wine characteristics cache (avoid repeat GPT-4 calls)
export const wineCharacteristicsCache = pgTable("wine_characteristics_cache", {
  id: serial("id").primaryKey(),
  wineSignature: varchar("wine_signature", { length: 500 }).notNull().unique(), // normalized: "chateau margaux|bordeaux|cabernet"
  characteristics: jsonb("characteristics").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  signatureIdx: index("idx_wine_cache_signature").on(table.wineSignature)
}));

// Wine characteristics structure
export interface WineCharacteristicsData {
  sweetness: number;    // 1-5 scale
  acidity: number;
  tannins: number;
  body: number;
  style: string;
  regionCharacter: string;
  source: 'cache' | 'gpt4';
}

export type WineCharacteristicsCacheEntry = typeof wineCharacteristicsCache.$inferSelect;

// ============================================
// LEARNING JOURNEYS (Product Pivot - Sprint 3)
// ============================================

// Journeys table - learning paths created by liaisons
export const journeys = pgTable("journeys", {
  id: serial("id").primaryKey(),
  liaisonId: integer("liaison_id").references(() => users.id), // null = system journey
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  difficultyLevel: varchar("difficulty_level", { length: 20 }).notNull().default('beginner'), // 'beginner', 'intermediate', 'advanced'
  estimatedDuration: varchar("estimated_duration", { length: 50 }), // e.g., "4 weeks", "8 wines"
  wineType: varchar("wine_type", { length: 50 }), // 'red', 'white', 'mixed', etc.
  coverImageUrl: text("cover_image_url"),
  isPublished: boolean("is_published").default(false).notNull(),
  totalChapters: integer("total_chapters").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  liaisonIdx: index("idx_journeys_liaison").on(table.liaisonId),
  publishedIdx: index("idx_journeys_published").on(table.isPublished),
  difficultyIdx: index("idx_journeys_difficulty").on(table.difficultyLevel)
}));

// Chapters table - individual steps in a journey
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  journeyId: integer("journey_id").notNull().references(() => journeys.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  wineRequirements: jsonb("wine_requirements"), // Criteria for valid wines
  learningObjectives: jsonb("learning_objectives"), // What user will learn
  tastingPrompts: jsonb("tasting_prompts"), // Guided questions during tasting
  completionCriteria: jsonb("completion_criteria"), // What counts as "complete"
  // Shopping guide fields - help users find wines at their local shop
  shoppingTips: text("shopping_tips"), // Natural language guidance for finding wine
  priceRange: jsonb("price_range"), // { min: number, max: number, currency: string }
  alternatives: jsonb("alternatives"), // Array of acceptable substitute wines/criteria
  askFor: text("ask_for"), // What to tell the wine shop staff
  // Multiple wine options at different price points
  wineOptions: jsonb("wine_options"), // Array of WineOption objects
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  journeyChapterIdx: unique().on(table.journeyId, table.chapterNumber),
  journeyIdx: index("idx_chapters_journey").on(table.journeyId)
}));

// User journey progress tracking
export const userJourneys = pgTable("user_journeys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  journeyId: integer("journey_id").notNull().references(() => journeys.id, { onDelete: "cascade" }),
  currentChapter: integer("current_chapter").default(1).notNull(),
  completedChapters: jsonb("completed_chapters").default([]).notNull(), // Array of {chapterId, completedAt, tastingId}
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at") // null until all chapters done
}, (table) => ({
  userJourneyUnique: unique().on(table.userId, table.journeyId),
  userIdx: index("idx_user_journeys_user").on(table.userId),
  journeyIdx: index("idx_user_journeys_journey").on(table.journeyId)
}));

// Insert schemas for journeys
export const insertJourneySchema = createInsertSchema(journeys, {
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().nullable().optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  estimatedDuration: z.string().nullable().optional(),
  wineType: z.enum(['red', 'white', 'rosé', 'sparkling', 'mixed']).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  isPublished: z.boolean().default(false)
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalChapters: true
});

export const insertChapterSchema = createInsertSchema(chapters, {
  journeyId: z.number().int().positive(),
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().nullable().optional(),
  wineRequirements: z.object({
    wineType: z.string().optional(),
    region: z.string().optional(),
    grapeVariety: z.string().optional(),
    minVintage: z.number().optional(),
    maxVintage: z.number().optional(),
    priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
    specificWine: z.string().optional(), // Exact wine match
    anyWine: z.boolean().optional() // Accept any wine
  }).nullable().optional(),
  learningObjectives: z.array(z.string()).nullable().optional(),
  tastingPrompts: z.array(z.object({
    question: z.string(),
    category: z.enum(['appearance', 'aroma', 'taste', 'structure', 'overall']).optional()
  })).nullable().optional(),
  completionCriteria: z.object({
    requirePhoto: z.boolean().default(true),
    requireAllPrompts: z.boolean().default(false),
    minRating: z.number().optional()
  }).nullable().optional(),
  // Shopping guide fields
  shoppingTips: z.string().nullable().optional(),
  priceRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('USD')
  }).nullable().optional(),
  alternatives: z.array(z.object({
    name: z.string(), // e.g., "Any medium-bodied Italian red"
    criteria: z.object({
      wineType: z.string().optional(),
      region: z.string().optional(),
      grapeVariety: z.string().optional()
    }).optional()
  })).nullable().optional(),
  askFor: z.string().nullable().optional()
}).omit({
  id: true,
  createdAt: true
});

export const insertUserJourneySchema = createInsertSchema(userJourneys, {
  userId: z.number().int().positive(),
  journeyId: z.number().int().positive(),
  currentChapter: z.number().int().positive().default(1),
  completedChapters: z.array(z.object({
    chapterId: z.number(),
    completedAt: z.string(),
    tastingId: z.number()
  })).default([])
}).omit({
  id: true,
  startedAt: true,
  lastActivityAt: true,
  completedAt: true
});

// Types for journeys
export type Journey = typeof journeys.$inferSelect;
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type UserJourney = typeof userJourneys.$inferSelect;
export type InsertUserJourney = z.infer<typeof insertUserJourneySchema>;

// Wine requirements structure
export interface WineRequirements {
  wineType?: string;
  region?: string;
  grapeVariety?: string;
  minVintage?: number;
  maxVintage?: number;
  priceRange?: { min: number; max: number };
  specificWine?: string;
  anyWine?: boolean;
}

// Completed chapter record
export interface CompletedChapter {
  chapterId: number;
  completedAt: string;
  tastingId: number;
}

// Shopping guide types
export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface WineAlternative {
  name: string; // e.g., "Any medium-bodied Italian red"
  criteria?: {
    wineType?: string;
    region?: string;
    grapeVariety?: string;
  };
}

// Full chapter shopping guide
export interface ChapterShoppingGuide {
  shoppingTips?: string;
  priceRange?: PriceRange;
  alternatives?: WineAlternative[];
  askFor?: string;
}

// Wine options for journey chapters — budget (under ~$25) and splurge tiers
export interface WineOption {
  description: string; // e.g., "Any Oregon Pinot Noir"
  askFor: string; // What to tell the wine shop staff
  priceRange?: PriceRange; // Optional — omit for splurge tier
  exampleProducers?: string[]; // e.g., ["Willamette Valley Vineyards", "A to Z"]
  level: 'budget' | 'splurge'; // Two-tier pricing
  whyThisWine?: string; // Optional explanation of fit for learning objective
  labelTips?: string; // What to look for on the label
  substitutes?: string[]; // Acceptable alternatives if this wine isn't available
}

// AI-generated next bottle recommendations
export interface TastingRecommendation {
  type: 'similar' | 'step_up' | 'exploration'; // Similar style, more complex, or different direction
  wineName: string; // e.g., "Willamette Valley Pinot Noir"
  reason: string; // Why this is recommended based on their responses
  priceRange: PriceRange;
  askFor: string; // What to tell the wine shop staff
}

// User tasting level progression
export type TastingLevel = 'intro' | 'intermediate' | 'advanced';

// ============================================
// SPRINT 5: AI QUESTION GENERATION & VALIDATION
// ============================================

// Chapter completions - tracks individual chapter completion with validation
export const chapterCompletions = pgTable("chapter_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  tastingId: integer("tasting_id").notNull().references(() => tastings.id),
  winePhotoUrl: text("wine_photo_url"),
  wineValidation: jsonb("wine_validation"), // WineValidationResult
  completedAt: timestamp("completed_at").defaultNow().notNull()
}, (table) => ({
  userChapterUnique: unique().on(table.userId, table.chapterId),
  userIdx: index("idx_chapter_completions_user").on(table.userId),
  chapterIdx: index("idx_chapter_completions_chapter").on(table.chapterId)
}));

// Generated questions - AI-generated questions for chapter tastings
export const generatedQuestions = pgTable("generated_questions", {
  id: serial("id").primaryKey(),
  chapterCompletionId: integer("chapter_completion_id").notNull().references(() => chapterCompletions.id, { onDelete: "cascade" }),
  questions: jsonb("questions").notNull(), // Array of GeneratedQuestion
  wineContext: jsonb("wine_context").notNull(), // WineRecognitionResult used for generation
  generatedAt: timestamp("generated_at").defaultNow().notNull()
}, (table) => ({
  completionIdx: index("idx_generated_questions_completion").on(table.chapterCompletionId)
}));

// Wine validation result structure
export interface WineValidationResult {
  passed: boolean;
  confidence: number;
  criteriaResults: Array<{
    field: string;
    operator: string;
    expected: string | string[];
    actual: string | null;
    passed: boolean;
  }>;
  wineInfo: WineRecognitionResult;
}

// Wine recognition result from GPT Vision
export interface WineRecognitionResult {
  name: string;
  region: string;
  grapeVarieties: string[];
  vintage?: number;
  producer?: string;
  confidence: number;
}

// Generated question structure (follows existing tasting flow)
// Question categories - the 5 core components + overall
export type QuestionCategory = 'fruit' | 'secondary' | 'tertiary' | 'body' | 'acidity' | 'tannins' | 'overall';

export interface GeneratedQuestion {
  id: string;
  category: QuestionCategory;
  questionType: 'multiple_choice' | 'scale' | 'text';
  title: string;
  description?: string;
  // For multiple_choice
  options?: Array<{
    id: string;
    text: string;
    description?: string;
  }>;
  allowMultiple?: boolean;
  // For scale
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: [string, string];
  // Wine-specific context
  wineContext?: string; // e.g., "Classic Barolo characteristics include..."
  // Three-beat loop fields
  beatType?: 'notice' | 'rate'; // Which beat this question represents (legacy questions omit this)
  educationalNote?: string; // Shown after user answers a 'notice' beat, before advancing to 'rate'
  preferenceDirection?: 'more' | 'less'; // For rate beats: what "high" means for preference
}

// Insert schemas
export const insertChapterCompletionSchema = createInsertSchema(chapterCompletions, {
  userId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  tastingId: z.number().int().positive(),
  winePhotoUrl: z.string().url().nullable().optional(),
  wineValidation: z.any().nullable().optional()
}).omit({
  id: true,
  completedAt: true
});

export const insertGeneratedQuestionsSchema = createInsertSchema(generatedQuestions, {
  chapterCompletionId: z.number().int().positive(),
  questions: z.array(z.any()),
  wineContext: z.any()
}).omit({
  id: true,
  generatedAt: true
});

// Types
export type ChapterCompletion = typeof chapterCompletions.$inferSelect;
export type InsertChapterCompletion = z.infer<typeof insertChapterCompletionSchema>;
export type GeneratedQuestionsRecord = typeof generatedQuestions.$inferSelect;
export type InsertGeneratedQuestions = z.infer<typeof insertGeneratedQuestionsSchema>;

// ============================================
// AI SOMMELIER CHAT
// ============================================

// Chat conversations
export const sommelierChats = pgTable("sommelier_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }),
  summary: text("summary"),
  lastSummaryAt: timestamp("last_summary_at"),
  messageCount: integer("message_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  userIdx: index("idx_sommelier_chats_user").on(table.userId),
  updatedAtIdx: index("idx_sommelier_chats_updated").on(table.updatedAt)
}));

// Chat messages
export const sommelierMessages = pgTable("sommelier_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => sommelierChats.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  imageDescription: text("image_description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  chatIdx: index("idx_sommelier_messages_chat").on(table.chatId),
  chatCreatedIdx: index("idx_sommelier_messages_chat_created").on(table.chatId, table.createdAt)
}));

// Insert schemas for sommelier chat
export const insertSommelierChatSchema = createInsertSchema(sommelierChats, {
  userId: z.number().int().positive(),
  title: z.string().max(200).nullable().optional(),
  summary: z.string().nullable().optional(),
  messageCount: z.number().int().default(0)
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSummaryAt: true
});

export const insertSommelierMessageSchema = createInsertSchema(sommelierMessages, {
  chatId: z.number().int().positive(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  imageDescription: z.string().nullable().optional(),
  metadata: z.any().nullable().optional()
}).omit({
  id: true,
  createdAt: true
});

// Types for sommelier chat
export type SommelierChat = typeof sommelierChats.$inferSelect;
export type InsertSommelierChat = z.infer<typeof insertSommelierChatSchema>;
export type SommelierMessage = typeof sommelierMessages.$inferSelect;
export type InsertSommelierMessage = z.infer<typeof insertSommelierMessageSchema>;

// ============================================
// AI RESPONSE CACHE (Performance Optimization)
// ============================================

export const aiResponseCache = pgTable("ai_response_cache", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  cacheKey: text("cache_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  responseData: jsonb("response_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  uniqueUserCacheKey: unique().on(table.userEmail, table.cacheKey),
  userEmailIdx: index("idx_ai_response_cache_email").on(table.userEmail)
}));

export type AiResponseCache = typeof aiResponseCache.$inferSelect;
