-- Create subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  daily_requests INTEGER NOT NULL,
  monthly_price_eur DECIMAL(10,2),
  yearly_price_eur DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plans
INSERT INTO public.subscription_plans (name, daily_requests, monthly_price_eur, yearly_price_eur) VALUES
  ('free', 10, 0, 0),
  ('investigator', 100, 30, 250),
  ('pro', 1000, 100, 1000)
ON CONFLICT (name) DO NOTHING;

-- No RLS needed for subscription plans as they are public reference data
