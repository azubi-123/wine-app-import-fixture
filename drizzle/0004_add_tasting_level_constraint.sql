-- Migration: Add CHECK constraint on tasting_level column
-- Date: 2026-01-27
-- Description: P2-008 - Ensures only valid tasting level values can be stored

-- Add CHECK constraint for valid tasting levels
-- This ensures database-level validation, not just TypeScript compile-time safety
ALTER TABLE users
ADD CONSTRAINT users_tasting_level_check
CHECK (tasting_level IN ('intro', 'intermediate', 'advanced'));
