-- Create usage tracking table
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Create index for efficient daily usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON public.api_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_date ON public.api_usage(api_key_id, date);

-- Enable RLS
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for API usage
CREATE POLICY "Users can view their own usage" ON public.api_usage
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "System can insert usage records" ON public.api_usage
  FOR INSERT WITH CHECK (true); -- API system needs to insert usage records
