-- 1. Corrigir policy da tabela scheduled_executions para permitir acesso de admins
DROP POLICY IF EXISTS "Only admins can view execution logs" ON public.scheduled_executions;

CREATE POLICY "Admins can view execution logs" 
ON public.scheduled_executions
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Criar tabela admin_whitelist para gerenciar admins de forma segura
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_at timestamp with time zone DEFAULT now(),
  added_by uuid REFERENCES auth.users(id),
  notes text
);

-- Habilitar RLS na tabela admin_whitelist
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver a whitelist
CREATE POLICY "Admins can view whitelist"
ON public.admin_whitelist
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem inserir na whitelist
CREATE POLICY "Admins can insert whitelist"
ON public.admin_whitelist
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem deletar da whitelist
CREATE POLICY "Admins can delete whitelist"
ON public.admin_whitelist
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir o email atual na whitelist
INSERT INTO public.admin_whitelist (email, notes)
VALUES ('vinicius.pnascimento@gmail.com', 'Admin inicial do sistema')
ON CONFLICT (email) DO NOTHING;

-- 3. Remover triggers antigos primeiro (CASCADE para remover dependências)
DROP TRIGGER IF EXISTS setup_vinicius_admin_trigger ON auth.users;
DROP TRIGGER IF EXISTS setup_vinicius_admin_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.setup_vinicius_admin() CASCADE;

-- 4. Criar nova função que usa admin_whitelist
CREATE OR REPLACE FUNCTION public.setup_admin_from_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se o email está na whitelist
  IF EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = NEW.email) THEN
    -- Atualizar profile com acesso ilimitado
    UPDATE public.profiles
    SET 
      subscription_plan = 'enterprise',
      manual_subscription = true,
      manual_groups_limit = 999,
      subscription_status = 'active',
      subscription_end_date = (NOW() + INTERVAL '100 years')
    WHERE id = NEW.id;
    
    -- Adicionar role de admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE LOG 'Admin access configured for email: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Criar trigger apenas em auth.users (momento de criação da conta)
CREATE TRIGGER setup_admin_from_whitelist_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.setup_admin_from_whitelist();