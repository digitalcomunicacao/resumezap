-- 1. Adicionar colunas de arquivamento em whatsapp_groups
ALTER TABLE whatsapp_groups
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Criar tabela de histórico de conexões
CREATE TABLE IF NOT EXISTS connection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id TEXT,
  instance_name TEXT,
  disconnected_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT CHECK (reason IN ('manual', 'expired', 'error')),
  groups_count INTEGER DEFAULT 0,
  summaries_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS para connection_history
ALTER TABLE connection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connection history"
ON connection_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert connection history"
ON connection_history FOR INSERT
WITH CHECK (true);

-- 4. Indexes para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_active 
ON whatsapp_groups(user_id, archived) 
WHERE archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_connection_history_user 
ON connection_history(user_id, disconnected_at DESC);

-- 5. Função para arquivar grupos não encontrados
CREATE OR REPLACE FUNCTION archive_missing_groups(
  p_user_id UUID,
  p_current_group_ids TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE whatsapp_groups
  SET archived = TRUE,
      archived_at = NOW()
  WHERE user_id = p_user_id
    AND archived = FALSE
    AND group_id <> ALL(p_current_group_ids);
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;