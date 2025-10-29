-- Fase 1: Configurar Cron Job e Sistema de Alertas

-- Habilitar extensões necessárias para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar tabela de alertas para o admin
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'cron_failure', 'high_error_rate', 'user_stuck', 'connection_issue'
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- RLS para admin_alerts
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alerts"
  ON admin_alerts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update alerts"
  ON admin_alerts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert alerts"
  ON admin_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger para criar alertas automáticos quando execuções falharem
CREATE OR REPLACE FUNCTION notify_admin_on_failure()
RETURNS TRIGGER AS $$
BEGIN
  -- Alerta quando execução falha completamente
  IF NEW.status = 'failed' THEN
    INSERT INTO admin_alerts (alert_type, severity, message, details)
    VALUES (
      'cron_failure',
      'critical',
      'Execução agendada falhou completamente',
      jsonb_build_object(
        'execution_id', NEW.id,
        'execution_time', NEW.execution_time,
        'users_processed', NEW.users_processed,
        'details', NEW.details
      )
    );
  END IF;
  
  -- Alerta quando mais de 50% dos usuários tiveram erro
  IF NEW.status = 'completed_with_errors' AND NEW.errors_count > (NEW.users_processed * 0.5) THEN
    INSERT INTO admin_alerts (alert_type, severity, message, details)
    VALUES (
      'high_error_rate',
      'high',
      format('Alta taxa de erro: %s de %s usuários falharam', NEW.errors_count, NEW.users_processed),
      jsonb_build_object(
        'execution_id', NEW.id,
        'execution_time', NEW.execution_time,
        'errors_count', NEW.errors_count,
        'users_processed', NEW.users_processed,
        'error_rate', ROUND((NEW.errors_count::numeric / NULLIF(NEW.users_processed, 0) * 100)::numeric, 2)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER alert_on_execution_failure
  AFTER INSERT OR UPDATE ON scheduled_executions
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_failure();

-- Configurar cron job para rodar de hora em hora
SELECT cron.schedule(
  'hourly-summary-generation',
  '0 * * * *', -- A cada hora cheia (00 minutos)
  $$
  SELECT
    net.http_post(
        url := 'https://wfzjcklrdevhblcuxaoq.supabase.co/functions/v1/scheduled-summaries',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmempja2xyZGV2aGJsY3V4YW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MTM4MzcsImV4cCI6MjA3NzA4OTgzN30._PGzS-wqjxJP7sKUb6HNquvHe3o4fjiShwChdbkAw8I"}'::jsonb,
        body := concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);