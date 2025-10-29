-- Migrar dados de profiles.summary_tone e profiles.summary_length para summary_preferences
-- Criar registros em summary_preferences para usuários que ainda não têm
INSERT INTO summary_preferences (user_id, tone, size)
SELECT p.id,
       CASE p.summary_tone
         WHEN 'casual' THEN 'casual'
         WHEN 'formal' THEN 'professional'
         WHEN 'tecnico' THEN 'professional'
         ELSE 'professional'
       END,
       CASE p.summary_length
         WHEN 'curto' THEN 'short'
         WHEN 'medio' THEN 'medium'
         WHEN 'longo' THEN 'long'
         ELSE 'medium'
       END
FROM profiles p
WHERE p.id NOT IN (SELECT user_id FROM summary_preferences)
  AND (p.summary_tone IS NOT NULL OR p.summary_length IS NOT NULL);

-- Atualizar registros existentes em summary_preferences com dados de profiles
UPDATE summary_preferences sp
SET 
  tone = CASE p.summary_tone
    WHEN 'casual' THEN 'casual'
    WHEN 'formal' THEN 'professional'
    WHEN 'tecnico' THEN 'professional'
    ELSE sp.tone
  END,
  size = CASE p.summary_length
    WHEN 'curto' THEN 'short'
    WHEN 'medio' THEN 'medium'
    WHEN 'longo' THEN 'long'
    ELSE sp.size
  END
FROM profiles p
WHERE sp.user_id = p.id
  AND (p.summary_tone IS NOT NULL OR p.summary_length IS NOT NULL);

-- Remover campos antigos de profiles (após migração bem-sucedida)
ALTER TABLE profiles DROP COLUMN IF EXISTS summary_tone;
ALTER TABLE profiles DROP COLUMN IF EXISTS summary_length;