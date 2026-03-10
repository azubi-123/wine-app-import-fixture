import { pgTable, foreignKey, unique, uuid, varchar, text, timestamp, boolean, index, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const packages = pgTable("packages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 10 }).notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sommelierId: uuid("sommelier_id"),
	isActive: boolean("is_active").default(true),
	isPublic: boolean("is_public").default(false),
	imageUrl: text("image_url"),
}, (table) => [
	foreignKey({
			columns: [table.sommelierId],
			foreignColumns: [sommeliers.id],
			name: "packages_sommelier_id_fkey"
		}).onDelete("set null"),
	unique("packages_code_key").on(table.code),
]);

export const slides = pgTable("slides", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packageWineId: uuid("package_wine_id").notNull(),
	position: integer().notNull(),
	type: varchar({ length: 50 }).notNull(),
	sectionType: varchar("section_type", { length: 20 }),
	payloadJson: jsonb("payload_json").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_slides_package_wine_position").using("btree", table.packageWineId.asc().nullsLast().op("uuid_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.packageWineId],
			foreignColumns: [packageWines.id],
			name: "slides_package_wine_id_fkey"
		}).onDelete("cascade"),
	unique("slides_package_wine_id_position_key").on(table.packageWineId, table.position),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packageId: uuid("package_id").notNull(),
	shortCode: varchar("short_code", { length: 8 }),
	status: varchar({ length: 20 }).default('waiting').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	activeParticipants: integer("active_participants").default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.packageId],
			foreignColumns: [packages.id],
			name: "sessions_package_id_fkey"
		}).onDelete("cascade"),
	unique("sessions_short_code_key").on(table.shortCode),
]);

export const participants = pgTable("participants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	email: varchar({ length: 255 }),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	isHost: boolean("is_host").default(false),
	progressPtr: integer("progress_ptr").default(0),
	lastActive: timestamp("last_active", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "participants_session_id_fkey"
		}).onDelete("cascade"),
]);

export const responses = pgTable("responses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	participantId: uuid("participant_id").notNull(),
	slideId: uuid("slide_id").notNull(),
	answerJson: jsonb("answer_json").notNull(),
	answeredAt: timestamp("answered_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	synced: boolean().default(true),
}, (table) => [
	foreignKey({
			columns: [table.participantId],
			foreignColumns: [participants.id],
			name: "responses_participant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.slideId],
			foreignColumns: [slides.id],
			name: "responses_slide_id_fkey"
		}).onDelete("cascade"),
	unique("responses_participant_id_slide_id_key").on(table.participantId, table.slideId),
]);

export const glossaryTerms = pgTable("glossary_terms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	term: text().notNull(),
	variations: text().array(),
	definition: text().notNull(),
	category: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("glossary_terms_term_key").on(table.term),
]);

export const wineCharacteristics = pgTable("wine_characteristics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	description: text(),
	scaleType: varchar("scale_type", { length: 20 }).notNull(),
	scaleMin: integer("scale_min"),
	scaleMax: integer("scale_max"),
	scaleLabels: jsonb("scale_labels"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wine_characteristics_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	unique("wine_characteristics_name_key").on(table.name),
]);

export const sommeliers = pgTable("sommeliers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	profileImageUrl: text("profile_image_url"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sommeliers_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("sommeliers_email_key").on(table.email),
]);

export const packageWines = pgTable("package_wines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packageId: uuid("package_id").notNull(),
	position: integer().notNull(),
	wineName: text("wine_name").notNull(),
	wineDescription: text("wine_description"),
	wineImageUrl: text("wine_image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	wineType: varchar("wine_type", { length: 50 }),
	vintage: integer(),
	region: text(),
	producer: text(),
	grapeVarietals: jsonb("grape_varietals"),
	alcoholContent: text("alcohol_content"),
	expectedCharacteristics: jsonb("expected_characteristics"),
	discussionQuestions: jsonb("discussion_questions").default([]),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_package_wines_type").using("btree", table.wineType.asc().nullsLast().op("text_ops")),
	index("idx_package_wines_vintage").using("btree", table.vintage.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.packageId],
			foreignColumns: [packages.id],
			name: "package_wines_package_id_fkey"
		}).onDelete("cascade"),
	unique("package_wines_package_id_position_key").on(table.packageId, table.position),
	unique("uq_package_wines_package_position").on(table.packageId, table.position),
]);

export const wineResponseAnalytics = pgTable("wine_response_analytics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packageWineId: uuid("package_wine_id").notNull(),
	characteristicName: varchar("characteristic_name", { length: 100 }).notNull(),
	expectedValue: text("expected_value"),
	averageUserValue: text("average_user_value"),
	accuracyScore: integer("accuracy_score"),
	responseCount: integer("response_count").default(0),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wine_analytics_wine_char").using("btree", table.packageWineId.asc().nullsLast().op("text_ops"), table.characteristicName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.packageWineId],
			foreignColumns: [packageWines.id],
			name: "wine_response_analytics_package_wine_id_fkey"
		}).onDelete("cascade"),
]);

export const slideTemplates = pgTable("slide_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	type: varchar({ length: 50 }).notNull(),
	payloadTemplate: jsonb("payload_template").notNull(),
	isPublic: boolean("is_public").default(true),
	usageCount: integer("usage_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sommelierId: uuid("sommelier_id"),
}, (table) => [
	index("idx_slide_templates_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.sommelierId],
			foreignColumns: [sommeliers.id],
			name: "slide_templates_sommelier_id_fkey"
		}).onDelete("set null"),
	unique("slide_templates_name_key").on(table.name),
]);

export const sessionWineSelections = pgTable("session_wine_selections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	packageWineId: uuid("package_wine_id").notNull(),
	position: integer().notNull(),
	isIncluded: boolean("is_included").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_session_wines_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_session_wines_session_position").using("btree", table.sessionId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	uniqueIndex("idx_unique_session_wine").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops"), table.packageWineId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.packageWineId],
			foreignColumns: [packageWines.id],
			name: "session_wine_selections_package_wine_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "session_wine_selections_session_id_fkey"
		}).onDelete("cascade"),
]);
