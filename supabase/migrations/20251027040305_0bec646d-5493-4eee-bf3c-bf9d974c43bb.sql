-- Fix search_path for update_whatsapp_groups_updated_at function with CASCADE
DROP FUNCTION IF EXISTS update_whatsapp_groups_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_whatsapp_groups_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_whatsapp_groups_timestamp
BEFORE UPDATE ON whatsapp_groups
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_groups_updated_at();