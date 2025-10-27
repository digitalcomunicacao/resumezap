-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create table to log cron executions (optional but useful for monitoring)
CREATE TABLE IF NOT EXISTS public.scheduled_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL,
  users_processed INTEGER DEFAULT 0,
  summaries_generated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on scheduled_executions (admin only)
ALTER TABLE public.scheduled_executions ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view execution logs
CREATE POLICY "Only admins can view execution logs"
  ON public.scheduled_executions
  FOR SELECT
  USING (false);

-- Schedule the cron job to run daily at 9 AM (Brazil time - UTC-3)
-- Runs at 12:00 UTC (9:00 AM Brazil time)
SELECT cron.schedule(
  'generate-daily-summaries',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a function to manually trigger the cron job (useful for testing)
CREATE OR REPLACE FUNCTION public.trigger_daily_summaries_manually()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT net.http_post(
    url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) INTO result;
  
  RETURN result;
END;
$$;