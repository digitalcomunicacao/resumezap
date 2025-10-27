-- 1. Criar tabela de qualificação de leads
CREATE TABLE public.lead_qualification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Dados de contato
  whatsapp text NOT NULL,
  city text NOT NULL,
  
  -- Dados profissionais
  profession text NOT NULL,
  
  -- Dados da empresa (condicionais)
  company_revenue text,
  company_employees text,
  
  -- Metadados
  qualified_at timestamp with time zone DEFAULT now(),
  lead_score integer DEFAULT 0,
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS para lead_qualification
ALTER TABLE public.lead_qualification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own qualification"
  ON public.lead_qualification FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own qualification"
  ON public.lead_qualification FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own qualification"
  ON public.lead_qualification FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all qualifications"
  ON public.lead_qualification FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all qualifications"
  ON public.lead_qualification FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Adicionar coluna de limite manual de grupos na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN manual_groups_limit integer DEFAULT NULL;

-- 3. Criar tabela de logs de ações admin
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) NOT NULL,
  action_type text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all actions"
  ON public.admin_actions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert actions"
  ON public.admin_actions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));