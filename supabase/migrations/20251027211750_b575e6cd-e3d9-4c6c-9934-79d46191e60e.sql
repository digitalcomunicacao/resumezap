-- ============================================================================
-- LIBERAR ACESSO TOTAL PARA vinicius.pnascimento@gmail.com
-- ============================================================================

-- 1. Criar trigger para configurar automaticamente quando o usuário se cadastrar
CREATE OR REPLACE FUNCTION public.setup_vinicius_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é o email específico
  IF NEW.email = 'vinicius.pnascimento@gmail.com' THEN
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
    
    RAISE LOG 'Admin access configured for vinicius.pnascimento@gmail.com';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Criar trigger que roda após criação do profile
DROP TRIGGER IF EXISTS setup_vinicius_admin_trigger ON public.profiles;
CREATE TRIGGER setup_vinicius_admin_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_vinicius_admin();

-- 3. Se o usuário já existir mas ainda não tem privilégios, atualizar agora
DO $$
DECLARE
  user_exists uuid;
BEGIN
  SELECT id INTO user_exists FROM public.profiles WHERE email = 'vinicius.pnascimento@gmail.com';
  
  IF user_exists IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      subscription_plan = 'enterprise',
      manual_subscription = true,
      manual_groups_limit = 999,
      subscription_status = 'active',
      subscription_end_date = (NOW() + INTERVAL '100 years')
    WHERE id = user_exists;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_exists, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Existing user updated with admin access';
  END IF;
END $$;

-- ============================================================================
-- RESUMO
-- ============================================================================
-- ✅ Trigger criado: qualquer cadastro com esse email recebe acesso total
-- ✅ Plano: Enterprise (ilimitado)
-- ✅ Grupos: 999 (ilimitado)
-- ✅ Role: Admin
-- ✅ Validade: 100 anos
-- ============================================================================