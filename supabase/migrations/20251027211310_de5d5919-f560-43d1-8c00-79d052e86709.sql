-- ============================================================================
-- FASE 1.2: CORREÇÃO FINAL - FUNCTION SEARCH PATH
-- ============================================================================

-- Corrigir função trigger_daily_summaries_manually com search_path seguro
CREATE OR REPLACE FUNCTION public.trigger_daily_summaries_manually()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT extensions.http_post(
    url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ============================================================================
-- RESUMO
-- ============================================================================
-- ✅ trigger_daily_summaries_manually com search_path = public
-- ============================================================================