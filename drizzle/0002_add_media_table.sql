-- Create media table for secure file references
CREATE TABLE IF NOT EXISTS "media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_id" varchar(12) NOT NULL UNIQUE,
  "sommelier_id" uuid,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid,
  "media_type" varchar(20) NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "file_size" integer NOT NULL,
  "storage_url" text NOT NULL,
  "thumbnail_url" text,
  "duration" integer,
  "metadata" jsonb,
  "is_public" boolean DEFAULT false,
  "uploaded_at" timestamp DEFAULT now(),
  "last_accessed_at" timestamp
);

-- Create indexes for efficient querying
CREATE INDEX "idx_media_public_id" ON "media" ("public_id");
CREATE INDEX "idx_media_entity" ON "media" ("entity_type", "entity_id");
CREATE INDEX "idx_media_sommelier" ON "media" ("sommelier_id");

-- Add migration for existing media URLs
-- This will need to be handled separately as a data migration script