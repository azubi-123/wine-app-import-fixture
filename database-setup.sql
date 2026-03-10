-- KnowYourGrape Wine Tasting Platform Database Setup
-- Execute this script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Packages table
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Slides table (ALL content lives here)
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('question', 'media', 'interlude')),
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  active_participants INTEGER DEFAULT 0
);

-- 4. Participants table  
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  email VARCHAR(255),
  display_name VARCHAR(100) NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  progress_ptr INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES slides(id) ON DELETE CASCADE,
  answer_json JSONB NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  UNIQUE(participant_id, slide_id)
);

-- Performance indexes
CREATE INDEX idx_packages_code ON packages(code);
CREATE INDEX idx_slides_package_position ON slides(package_id, position);
CREATE INDEX idx_participants_session ON participants(session_id);
CREATE INDEX idx_participants_email_session ON participants(email, session_id);
CREATE INDEX idx_responses_participant ON responses(participant_id);
CREATE INDEX idx_responses_synced ON responses(synced) WHERE synced = false;

-- Insert sample data
INSERT INTO packages (code, name, description) VALUES 
('WINE01', 'Bordeaux Discovery Collection', 'Explore the finest wines from France''s most prestigious region');

-- Get the package ID for slides
WITH pkg AS (SELECT id FROM packages WHERE code = 'WINE01')
INSERT INTO slides (package_id, position, type, payload_json) VALUES 
-- Welcome slide
((SELECT id FROM pkg), 1, 'interlude', '{
  "title": "Welcome to Your Wine Tasting",
  "description": "Let''s begin our journey through Bordeaux",
  "wine_name": "2018 Château Margaux",
  "wine_image": "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=600"
}'),

-- Aroma question
((SELECT id FROM pkg), 2, 'question', '{
  "title": "What aromas do you detect?",
  "description": "Take a moment to swirl and smell. Select all the aromas you can identify.",
  "question_type": "multiple_choice",
  "category": "Aroma",
  "options": [
    {"id": "1", "text": "Dark fruits (blackberry, plum)", "description": "Rich, concentrated berry aromas"},
    {"id": "2", "text": "Vanilla and oak", "description": "From barrel aging"},
    {"id": "3", "text": "Spices (pepper, clove)", "description": "Complex spice notes"},
    {"id": "4", "text": "Floral notes", "description": "Violet or rose petals"},
    {"id": "5", "text": "Earth and minerals", "description": "Terroir characteristics"}
  ],
  "allow_multiple": true,
  "allow_notes": true
}'),

-- Intensity scale
((SELECT id FROM pkg), 3, 'question', '{
  "title": "Rate the aroma intensity",
  "description": "How strong are the aromas? 1 = Very light, 10 = Very intense",
  "question_type": "scale",
  "category": "Intensity",
  "scale_min": 1,
  "scale_max": 10,
  "scale_labels": ["Very Light", "Very Intense"]
}'),

-- Taste question
((SELECT id FROM pkg), 4, 'question', '{
  "title": "Describe the taste profile",
  "description": "Take a sip and identify the flavors you experience.",
  "question_type": "multiple_choice",
  "category": "Taste",
  "options": [
    {"id": "1", "text": "Red fruits (cherry, raspberry)", "description": "Bright fruit flavors"},
    {"id": "2", "text": "Dark fruits (blackcurrant, plum)", "description": "Rich, deep fruit flavors"},
    {"id": "3", "text": "Chocolate and coffee", "description": "Rich, roasted notes"},
    {"id": "4", "text": "Tobacco and leather", "description": "Aged, complex flavors"},
    {"id": "5", "text": "Herbs and spices", "description": "Savory elements"}
  ],
  "allow_multiple": true,
  "allow_notes": true
}'),

-- Body assessment
((SELECT id FROM pkg), 5, 'question', '{
  "title": "How would you describe the body?",
  "description": "The weight and fullness of the wine in your mouth",
  "question_type": "scale",
  "category": "Body",
  "scale_min": 1,
  "scale_max": 5,
  "scale_labels": ["Light Body", "Full Body"]
}'),

-- Tannin level
((SELECT id FROM pkg), 6, 'question', '{
  "title": "Tannin level assessment",
  "description": "How much dryness and grip do you feel on your gums and tongue?",
  "question_type": "scale",
  "category": "Tannins",
  "scale_min": 1,
  "scale_max": 10,
  "scale_labels": ["Soft Tannins", "Firm Tannins"]
}'),

-- Finish evaluation
((SELECT id FROM pkg), 7, 'question', '{
  "title": "How long is the finish?",
  "description": "How long do the flavors linger after swallowing?",
  "question_type": "scale",
  "category": "Finish",
  "scale_min": 1,
  "scale_max": 10,
  "scale_labels": ["Short Finish", "Very Long Finish"]
}'),

-- Overall rating
((SELECT id FROM pkg), 8, 'question', '{
  "title": "Overall wine rating",
  "description": "Your overall impression of this wine",
  "question_type": "scale",
  "category": "Overall",
  "scale_min": 1,
  "scale_max": 10,
  "scale_labels": ["Poor", "Excellent"]
}');

-- Enable Row Level Security (optional but recommended)
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Enable read access for all users" ON packages FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON slides FOR SELECT USING (true);
CREATE POLICY "Enable all access for sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Enable all access for participants" ON participants FOR ALL USING (true);
CREATE POLICY "Enable all access for responses" ON responses FOR ALL USING (true);