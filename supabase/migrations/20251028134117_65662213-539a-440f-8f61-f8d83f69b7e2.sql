-- Adicionar colunas para suportar conexão temporária preservando notificações

-- 1. Tabela whatsapp_connections: rastrear tipo de conexão e último momento conectado
ALTER TABLE public.whatsapp_connections
ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'temporary',
ADD COLUMN IF NOT EXISTS last_connected_at timestamp with time zone;

-- Adicionar constraint para validar connection_type
ALTER TABLE public.whatsapp_connections
ADD CONSTRAINT whatsapp_connections_connection_type_check 
CHECK (connection_type IN ('temporary', 'persistent'));

-- 2. Tabela profiles: permitir usuário escolher modo de conexão
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'temporary';

-- Adicionar constraint para validar connection_mode
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_connection_mode_check 
CHECK (connection_mode IN ('temporary', 'persistent'));

-- Comentários para documentação
COMMENT ON COLUMN whatsapp_connections.connection_type IS 'Tipo de conexão: temporary (conecta apenas para resumos) ou persistent (sempre conectado)';
COMMENT ON COLUMN whatsapp_connections.last_connected_at IS 'Último momento em que a conexão foi estabelecida';
COMMENT ON COLUMN profiles.connection_mode IS 'Preferência do usuário: temporary (preserva notificações) ou persistent (sempre online)';