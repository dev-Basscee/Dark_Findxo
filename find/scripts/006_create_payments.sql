-- Create payments table for Solana transactions
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  transaction_signature TEXT UNIQUE NOT NULL,
  amount_sol DECIMAL(20,9) NOT NULL,
  amount_eur DECIMAL(10,2) NOT NULL,
  plan_name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for payments
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "Users can insert their own payments" ON public.payments
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE wallet_address = current_setting('app.current_wallet', true)
    )
  );

CREATE POLICY "System can update payment status" ON public.payments
  FOR UPDATE USING (true); -- Payment system needs to update status
