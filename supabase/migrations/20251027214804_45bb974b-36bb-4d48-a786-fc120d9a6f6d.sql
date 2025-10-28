-- Add enterprise detail level column to summary preferences
ALTER TABLE summary_preferences 
ADD COLUMN IF NOT EXISTS enterprise_detail_level text DEFAULT 'full' 
CHECK (enterprise_detail_level IN ('full', 'ultra', 'audit'));

COMMENT ON COLUMN summary_preferences.enterprise_detail_level IS 'Level of detail for Enterprise plan summaries: full (default), ultra (sentiment per user), audit (all metadata)';