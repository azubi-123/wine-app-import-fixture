-- Migration: Add tasting level progression system
-- Date: 2026-01-27
-- Description: Adds user tasting level fields and recommendations to tastings

-- Add tasting level columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tasting_level VARCHAR(20) DEFAULT 'intro' NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tastings_completed INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_up_prompt_eligible BOOLEAN DEFAULT false NOT NULL;

-- Add recommendations column to tastings table
ALTER TABLE tastings ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Add wine_options column to chapters table
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS wine_options JSONB;

-- Add index for efficient level-up queries
CREATE INDEX IF NOT EXISTS idx_users_tasting_level ON users(tasting_level);
