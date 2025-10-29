-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para execução a cada hora
-- Se já existir, o sistema irá manter o existente
SELECT cron.schedule(
  'daily-summaries-cron',
  '0 * * * *', -- Todo início de hora (00 minutos)
  $$
  SELECT net.http_post(
    url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);