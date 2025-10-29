-- Add RLS policies for admins to view connection data

-- Admin can view all whatsapp connections
CREATE POLICY "Admins can view all whatsapp connections"
ON whatsapp_connections FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all connection history
CREATE POLICY "Admins can view all connection history"
ON connection_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));