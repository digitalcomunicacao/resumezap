-- Adicionar coluna para controlar envio automático nos grupos
ALTER TABLE public.profiles 
ADD COLUMN send_summary_to_group BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.send_summary_to_group IS 
'Se true, envia o resumo automaticamente no grupo do WhatsApp';

-- Criar tabela para rastrear envios de resumos
CREATE TABLE public.summary_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  group_id TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  evolution_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.summary_deliveries ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own deliveries"
  ON public.summary_deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_summary_deliveries_summary ON public.summary_deliveries(summary_id);
CREATE INDEX idx_summary_deliveries_user ON public.summary_deliveries(user_id);
CREATE INDEX idx_summary_deliveries_status ON public.summary_deliveries(status);