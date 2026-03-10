import { relations } from "drizzle-orm/relations";
import { sommeliers, packages, packageWines, slides, sessions, participants, responses, wineResponseAnalytics, slideTemplates, sessionWineSelections } from "./schema";

export const packagesRelations = relations(packages, ({one, many}) => ({
	sommelier: one(sommeliers, {
		fields: [packages.sommelierId],
		references: [sommeliers.id]
	}),
	sessions: many(sessions),
	packageWines: many(packageWines),
}));

export const sommeliersRelations = relations(sommeliers, ({many}) => ({
	packages: many(packages),
	slideTemplates: many(slideTemplates),
}));

export const slidesRelations = relations(slides, ({one, many}) => ({
	packageWine: one(packageWines, {
		fields: [slides.packageWineId],
		references: [packageWines.id]
	}),
	responses: many(responses),
}));

export const packageWinesRelations = relations(packageWines, ({one, many}) => ({
	slides: many(slides),
	package: one(packages, {
		fields: [packageWines.packageId],
		references: [packages.id]
	}),
	wineResponseAnalytics: many(wineResponseAnalytics),
	sessionWineSelections: many(sessionWineSelections),
}));

export const sessionsRelations = relations(sessions, ({one, many}) => ({
	package: one(packages, {
		fields: [sessions.packageId],
		references: [packages.id]
	}),
	participants: many(participants),
	sessionWineSelections: many(sessionWineSelections),
}));

export const participantsRelations = relations(participants, ({one, many}) => ({
	session: one(sessions, {
		fields: [participants.sessionId],
		references: [sessions.id]
	}),
	responses: many(responses),
}));

export const responsesRelations = relations(responses, ({one}) => ({
	participant: one(participants, {
		fields: [responses.participantId],
		references: [participants.id]
	}),
	slide: one(slides, {
		fields: [responses.slideId],
		references: [slides.id]
	}),
}));

export const wineResponseAnalyticsRelations = relations(wineResponseAnalytics, ({one}) => ({
	packageWine: one(packageWines, {
		fields: [wineResponseAnalytics.packageWineId],
		references: [packageWines.id]
	}),
}));

export const slideTemplatesRelations = relations(slideTemplates, ({one}) => ({
	sommelier: one(sommeliers, {
		fields: [slideTemplates.sommelierId],
		references: [sommeliers.id]
	}),
}));

export const sessionWineSelectionsRelations = relations(sessionWineSelections, ({one}) => ({
	packageWine: one(packageWines, {
		fields: [sessionWineSelections.packageWineId],
		references: [packageWines.id]
	}),
	session: one(sessions, {
		fields: [sessionWineSelections.sessionId],
		references: [sessions.id]
	}),
}));