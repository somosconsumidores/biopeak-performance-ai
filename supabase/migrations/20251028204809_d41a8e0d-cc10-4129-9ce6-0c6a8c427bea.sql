-- Table: ai_coach_conversations
-- Stores all chat message history
CREATE TABLE ai_coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  context_used jsonb DEFAULT '{}'::jsonb,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

-- Table: ai_coach_conversation_sessions
-- Manages conversation sessions
CREATE TABLE ai_coach_conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text,
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  total_tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: ai_coach_insights_history
-- Tracks important insights already given to the user
CREATE TABLE ai_coach_insights_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  insight_type text NOT NULL,
  insight_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  mentioned_in_conversation_id uuid,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Indexes for performance
CREATE INDEX idx_ai_coach_conversations_user ON ai_coach_conversations(user_id, created_at DESC);
CREATE INDEX idx_ai_coach_conversations_conversation ON ai_coach_conversations(conversation_id, created_at);
CREATE INDEX idx_conversation_sessions_user ON ai_coach_conversation_sessions(user_id, last_message_at DESC);
CREATE INDEX idx_insights_history_user ON ai_coach_insights_history(user_id, created_at DESC);
CREATE INDEX idx_insights_history_type ON ai_coach_insights_history(insight_type, created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coach_insights_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_coach_conversations
CREATE POLICY "Users can view their own conversations"
  ON ai_coach_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON ai_coach_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_coach_conversation_sessions
CREATE POLICY "Users can manage their own sessions"
  ON ai_coach_conversation_sessions FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for ai_coach_insights_history
CREATE POLICY "Users can view their own insights"
  ON ai_coach_insights_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage insights"
  ON ai_coach_insights_history FOR ALL
  USING (auth.role() = 'service_role');