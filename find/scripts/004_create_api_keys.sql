-- Create API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for API keys
CREATE POLICY "Users can view their own API keys" ON public.api_keys
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "Users can insert their own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "Users can update their own API keys" ON public.api_keys
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "Users can delete their own API keys" ON public.api_keys
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );
