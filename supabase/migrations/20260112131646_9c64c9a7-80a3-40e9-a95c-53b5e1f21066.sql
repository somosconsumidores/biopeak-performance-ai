-- Create table to store OneSignal Player IDs linked to users
CREATE TABLE public.push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  is_active BOOLEAN DEFAULT true,
  device_model TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create index for faster lookups
CREATE INDEX idx_push_tokens_user_id ON public.push_notification_tokens(user_id);
CREATE INDEX idx_push_tokens_player_id ON public.push_notification_tokens(player_id);
CREATE INDEX idx_push_tokens_active ON public.push_notification_tokens(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own push tokens"
ON public.push_notification_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own push tokens"
ON public.push_notification_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own push tokens"
ON public.push_notification_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own push tokens"
ON public.push_notification_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_push_notification_tokens_updated_at
BEFORE UPDATE ON public.push_notification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create notification history table for tracking sent notifications
CREATE TABLE public.push_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  notification_type TEXT,
  onesignal_notification_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'clicked', 'failed')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for notification history
CREATE INDEX idx_notification_history_user_id ON public.push_notification_history(user_id);
CREATE INDEX idx_notification_history_type ON public.push_notification_history(notification_type);
CREATE INDEX idx_notification_history_sent_at ON public.push_notification_history(sent_at DESC);

-- Enable RLS
ALTER TABLE public.push_notification_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history
CREATE POLICY "Users can view their own notification history"
ON public.push_notification_history
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert notifications (edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.push_notification_history
FOR INSERT
WITH CHECK (true);