-- Add generic_questions column to slides table
ALTER TABLE slides ADD COLUMN generic_questions jsonb;

-- Add check constraint to ensure valid generic question format
ALTER TABLE slides ADD CONSTRAINT valid_generic_question CHECK (
  generic_questions IS NULL OR (
    generic_questions ? 'format' AND
    generic_questions ? 'config' AND
    generic_questions->>'format' IN (
      'multiple_choice', 'scale', 'text', 'boolean', 'ranking', 'matrix'
    )
  )
);

-- Create indexes for efficient querying
CREATE INDEX idx_slides_question_format ON slides ((generic_questions->>'format'));
CREATE INDEX idx_slides_question_tags ON slides USING gin ((generic_questions->'metadata'->'tags'));

-- Migrate existing question data to generic format
UPDATE slides 
SET generic_questions = 
  CASE 
    WHEN type = 'question' AND payload_json IS NOT NULL THEN
      jsonb_build_object(
        'format', 
        CASE 
          WHEN payload_json->>'question_type' = 'multiple_choice' OR payload_json->>'questionType' = 'multiple_choice' THEN 'multiple_choice'
          WHEN payload_json->>'question_type' = 'scale' OR payload_json->>'questionType' = 'scale' THEN 'scale'
          WHEN payload_json->>'question_type' = 'text' OR payload_json->>'questionType' = 'text' THEN 'text'
          WHEN payload_json->>'question_type' = 'boolean' OR payload_json->>'questionType' = 'boolean' THEN 'boolean'
          ELSE 'text'
        END,
        'config', jsonb_build_object(
          'title', COALESCE(payload_json->>'title', payload_json->>'question', ''),
          'description', COALESCE(payload_json->>'description', ''),
          'options', 
          CASE 
            WHEN payload_json ? 'options' THEN payload_json->'options'
            ELSE '[]'::jsonb
          END,
          'allowMultiple', COALESCE(
            (payload_json->>'allow_multiple')::boolean, 
            (payload_json->>'allowMultiple')::boolean, 
            false
          ),
          'allowNotes', COALESCE(
            (payload_json->>'allow_notes')::boolean,
            (payload_json->>'allowNotes')::boolean,
            false
          ),
          'scaleMin', COALESCE(
            (payload_json->>'scale_min')::integer,
            (payload_json->>'scaleMin')::integer,
            1
          ),
          'scaleMax', COALESCE(
            (payload_json->>'scale_max')::integer,
            (payload_json->>'scaleMax')::integer,
            10
          ),
          'scaleLabels', 
          CASE 
            WHEN payload_json ? 'scale_labels' THEN payload_json->'scale_labels'
            WHEN payload_json ? 'scaleLabels' THEN payload_json->'scaleLabels'
            ELSE '["Low", "High"]'::jsonb
          END
        ),
        'metadata', jsonb_build_object(
          'migrated', true,
          'migratedAt', NOW(),
          'category', COALESCE(payload_json->>'category', 'general'),
          'tags', '[]'::jsonb,
          'difficulty', 'intermediate'
        )
      )
    ELSE NULL
  END
WHERE type = 'question';