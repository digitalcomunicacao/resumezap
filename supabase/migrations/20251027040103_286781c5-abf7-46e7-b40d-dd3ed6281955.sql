-- Create whatsapp_groups table
CREATE TABLE whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_connection_id UUID NOT NULL REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  group_image TEXT,
  participant_count INTEGER DEFAULT 0,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Create indices for better performance
CREATE INDEX idx_groups_user_id ON whatsapp_groups(user_id);
CREATE INDEX idx_groups_selected ON whatsapp_groups(user_id, is_selected);
CREATE INDEX idx_groups_connection ON whatsapp_groups(whatsapp_connection_id);

-- Enable RLS
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own groups"
  ON whatsapp_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own groups"
  ON whatsapp_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own groups"
  ON whatsapp_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own groups"
  ON whatsapp_groups FOR DELETE
  USING (auth.uid() = user_id);

-- Add selected_groups_count to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS selected_groups_count INTEGER DEFAULT 0;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_whatsapp_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_whatsapp_groups_timestamp
BEFORE UPDATE ON whatsapp_groups
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_groups_updated_at();