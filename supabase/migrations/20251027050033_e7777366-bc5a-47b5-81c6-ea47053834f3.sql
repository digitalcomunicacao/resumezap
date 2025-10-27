-- Adicionar coluna de horário preferido na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_summary_time TIME DEFAULT '09:00:00';

-- Criar novo cron job para rodar a cada hora
SELECT cron.schedule(
  'hourly-summaries',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT net.http_post(
    url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Adicionar índice para melhor performance nas buscas por horário
CREATE INDEX IF NOT EXISTS idx_profiles_summary_time ON public.profiles(preferred_summary_time);