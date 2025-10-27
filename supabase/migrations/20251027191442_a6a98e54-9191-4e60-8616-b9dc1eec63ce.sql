-- Fase 1: Limpeza de Conexões Duplicadas do WhatsApp

-- 1. Marcar todas as conexões antigas como disconnected, mantendo apenas a mais recente por usuário
UPDATE whatsapp_connections
SET status = 'disconnected'
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM whatsapp_connections
  ORDER BY user_id, created_at DESC
);

-- 2. Adicionar constraint UNIQUE para evitar duplicatas futuras
-- Primeiro, remover qualquer constraint existente se houver
ALTER TABLE whatsapp_connections
DROP CONSTRAINT IF EXISTS whatsapp_connections_user_id_unique;

-- Criar índice único parcial: apenas uma conexão ativa/connecting por usuário
DROP INDEX IF EXISTS idx_whatsapp_connections_one_active_per_user;
CREATE UNIQUE INDEX idx_whatsapp_connections_one_active_per_user 
ON whatsapp_connections(user_id) 
WHERE status IN ('connected', 'connecting');

-- 3. Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user_status 
ON whatsapp_connections(user_id, status);

-- 4. Criar índice para queries de conexões ativas
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_status 
ON whatsapp_connections(status) 
WHERE status = 'connected';