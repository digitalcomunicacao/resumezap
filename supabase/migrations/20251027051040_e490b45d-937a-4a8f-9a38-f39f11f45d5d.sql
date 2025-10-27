-- Adicionar colunas de preferências de resumo na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN summary_tone TEXT DEFAULT 'casual' CHECK (summary_tone IN ('formal', 'casual', 'tecnico')),
ADD COLUMN summary_length TEXT DEFAULT 'medio' CHECK (summary_length IN ('curto', 'medio', 'longo'));

COMMENT ON COLUMN public.profiles.summary_tone IS 
'Tom do resumo: formal, casual, ou tecnico';

COMMENT ON COLUMN public.profiles.summary_length IS 
'Tamanho do resumo: curto, medio, ou longo';