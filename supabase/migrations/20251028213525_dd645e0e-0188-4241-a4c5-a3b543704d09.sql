-- Add UNIQUE constraint to whatsapp_groups for efficient upsert
-- This allows batch operations instead of individual queries per group

ALTER TABLE public.whatsapp_groups 
ADD CONSTRAINT whatsapp_groups_user_group_unique 
UNIQUE (user_id, group_id);

-- Add index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_user_connection 
ON public.whatsapp_groups(user_id, whatsapp_connection_id);

-- Add index for group_id lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_group_id 
ON public.whatsapp_groups(group_id);