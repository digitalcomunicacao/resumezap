-- Create summaries table
CREATE TABLE public.summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own summaries"
  ON public.summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries"
  ON public.summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries"
  ON public.summaries FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX summaries_user_date_idx ON public.summaries(user_id, summary_date DESC);
CREATE INDEX summaries_group_idx ON public.summaries(user_id, group_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_summaries_updated_at()
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

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_summaries_updated_at
  BEFORE UPDATE ON public.summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_summaries_updated_at();