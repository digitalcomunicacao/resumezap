-- Update RLS policy to allow anonymous visitor tracking
DROP POLICY IF EXISTS "Users can insert own events" ON analytics_events;

CREATE POLICY "Anyone can insert analytics events"
ON analytics_events
FOR INSERT
WITH CHECK (
  user_id IS NULL OR auth.uid() = user_id
);