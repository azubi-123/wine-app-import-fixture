# Wine App Import Fixture - Manifest

## Purpose
Reduced export of a real wine tasting education platform (Cata/KYG) for testing
an import/reconstruction analyzer pipeline. NOT a production build.

## Source
Derived from `kyg-dev/` — a full-stack TypeScript monolith (Express + React + PostgreSQL).

## Stats
- **Total files:** ~142
- **TS/TSX source files:** ~125
- **Original codebase:** ~487 files
- **Reduction:** ~70% fewer files

## Features Kept

### 1. Solo Tasting (core workflow)
- Create a new tasting (snap a wine bottle, get AI-generated profile)
- Active tasting session with structured questions (scale, multiple choice, text, boolean)
- Tasting detail view (review past tastings)
- Pages: SoloTastingNew, SoloTastingSession, SoloTastingDetail
- Server: routes/tastings, routes/wines, services/questionGenerator, wine-intelligence

### 2. AI Sommelier (Pierre)
- Floating chat assistant available throughout the app
- Context-aware wine recommendations using user's tasting history
- Image recognition for wine labels
- Chat history with compaction
- Components: sommelier/ (9 files)
- Server: routes/sommelier-chat, services/sommelierChatService, services/sommelierContextBuilder

### 3. User Dashboard & Analytics
- Wine preference visualization (flavor profiles, preferred characteristics)
- Tasting history and wine identity card
- Wine map (geographic origins)
- Recommendations and conversation starters
- Pages: UserDashboard, HomeV2
- Components: dashboard/ (5 files)
- Server: routes/dashboard, services/wineRecommendations

### 4. Onboarding
- Quiz-based preference capture for new users
- Feeds recommendation engine
- Pages: OnboardingQuiz

### 5. Landing
- Public-facing landing page showing product identity
- Pages: Landing

## Features Removed

| Feature | Files Removed | Reason |
|---|---|---|
| Group Tasting (sessions, packages, slides) | ~25 | Multi-user real-time feature; not needed for complexity test |
| Learning Journeys (browse, detail, chapters) | ~5 | Educational content feature; not needed for complexity test |
| Package Editor (drag-and-drop slide builder) | ~13 | Content authoring for group tastings |
| Admin pages (JourneyAdmin, SommelierDashboard) | removed in prior pass | Admin-only |
| Auth/Login/Profile pages | removed in prior pass | Peripheral |
| All root-level docs, test scripts, planning docs | ~180 | Not source code |

## Key Shared Tables/Entities (from shared/schema.ts)

| Entity | Key Relationships |
|---|---|
| `users` | Has many tastings, sommelier chats, preferences |
| `tastings` | Belongs to user; stores wine data, responses, AI analysis |
| `packages` | Has many packageWines, slides; creates sessions |
| `packageWines` | Belongs to package; wines within a tasting package |
| `slides` | Belongs to package+wine; configures questions |
| `sessions` | Created from package; has participants, responses |
| `participants` | Belongs to session; has responses |
| `responses` | Belongs to participant+slide; stores answers |
| `sommelierChats` | Belongs to user; has messages |
| `sommelierMessages` | Belongs to chat; stores conversation |
| `glossaryTerms` | Wine terminology definitions |
| `wineCharacteristics` | Wine attribute definitions with scales |
| `wineCharacteristicsCache` | Cached AI-generated wine profiles |

Note: Schema retains ALL tables from the full app (including group/journey tables)
to preserve the complete data model for analysis.

## Key Workflows Preserved

1. **Solo Tasting:** User snaps wine -> AI generates profile -> structured questions -> save responses -> view insights
2. **AI Sommelier:** User asks Pierre -> context from tasting history -> GPT response with recommendations
3. **Dashboard:** Aggregated preference visualization, wine identity, geographic map, recommendations
4. **Onboarding:** Quiz captures preferences -> feeds recommendation engine

## Architecture Signals for Analyzer

- **Monolith with feature boundaries** — routes, pages, components organized by feature
- **Relational persistence** — Drizzle ORM + PostgreSQL, complex FK relationships
- **Shared data layer** — single schema.ts, single storage.ts (6900+ lines)
- **AI integration** — OpenAI for wine intelligence, transcription, sentiment, recommendations
- **Feature cross-references** — sommelier chat uses tasting history; dashboard aggregates across features

## Buildability

Analysis fixture only. To run, you would need PostgreSQL, OPENAI_API_KEY, DATABASE_URL, and npm install.
The code is structurally coherent — imports resolve within the fixture.
