-- Adicionar coluna timezone na tabela summary_preferences
ALTER TABLE summary_preferences 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN summary_preferences.timezone IS 'Timezone IANA para formatação de datas (ex: America/Sao_Paulo, America/Manaus, America/Rio_Branco)';