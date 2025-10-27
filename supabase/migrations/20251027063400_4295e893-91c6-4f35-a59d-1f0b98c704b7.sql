-- Criar tabela de preferências de resumo
CREATE TABLE IF NOT EXISTS summary_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tone VARCHAR(20) DEFAULT 'professional',
  size VARCHAR(20) DEFAULT 'medium',
  thematic_focus TEXT,
  include_sentiment_analysis BOOLEAN DEFAULT false,
  enable_smart_alerts BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de logs de geração manual
CREATE TABLE IF NOT EXISTS manual_summary_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_plan VARCHAR(20)
);

-- Criar tabela de analytics de mensagens
CREATE TABLE IF NOT EXISTS message_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  group_id VARCHAR NOT NULL,
  group_name VARCHAR NOT NULL,
  date DATE NOT NULL,
  message_count INT NOT NULL,
  sentiment VARCHAR(20),
  top_topics TEXT[],
  peak_hours INT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE summary_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_summary_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_analytics ENABLE ROW LEVEL SECURITY;

-- Políticas para summary_preferences
CREATE POLICY "Users can view own preferences" ON summary_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON summary_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON summary_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para manual_summary_logs
CREATE POLICY "Users can view own logs" ON manual_summary_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON manual_summary_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para message_analytics
CREATE POLICY "Users can view own analytics" ON message_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" ON message_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);