-- ============================================================================
-- FASE 1.1: CORREÇÃO FINAL - MOVER EXTENSION PG_NET
-- ============================================================================

-- Nota: pg_net não suporta ALTER EXTENSION SET SCHEMA
-- Precisamos dropar e recriar no schema correto

-- 1. Dropar a extension do schema public (se existir)
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- 2. Criar schema extensions se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- 3. Recriar pg_net no schema extensions (sem especificar versão)
CREATE EXTENSION IF NOT EXISTS pg_net 
  SCHEMA extensions;

-- 4. Garantir permissões corretas
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- RESUMO
-- ============================================================================
-- ✅ pg_net movida de public para extensions
-- ✅ Schema extensions criado
-- ✅ Permissões configuradas
-- ============================================================================