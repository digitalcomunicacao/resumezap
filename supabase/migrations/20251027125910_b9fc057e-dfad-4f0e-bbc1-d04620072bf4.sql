-- Como todas duplicatas são do usuário rodrigoaraujo, 
-- vamos apenas prevenir duplicatas futuras sem remover histórico
-- Primeiro removemos apenas as duplicatas mais recentes do rodrigoaraujo
DELETE FROM summary_deliveries
WHERE id IN (
  SELECT d1.id
  FROM summary_deliveries d1
  INNER JOIN summary_deliveries d2 ON d1.summary_id = d2.summary_id 
    AND d1.group_id = d2.group_id 
    AND d1.created_at > d2.created_at
);

-- Adicionar constraint única
ALTER TABLE summary_deliveries 
ADD CONSTRAINT unique_summary_group_delivery 
UNIQUE (summary_id, group_id);