-- Add better payment tracking and verification

-- Add index for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_signature ON public.payments(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_active ON public.user_subscriptions(user_id, status) WHERE status = 'active';

-- Function to process successful payment and update subscription
CREATE OR REPLACE FUNCTION process_payment_and_subscription(
  payment_signature TEXT,
  user_wallet TEXT,
  plan_name TEXT,
  billing_period TEXT,
  amount_sol NUMERIC,
  amount_eur NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid UUID;
  payment_uuid UUID;
  success BOOLEAN := FALSE;
BEGIN
  -- Start transaction
  BEGIN
    -- Get or create user
    SELECT id INTO user_uuid
    FROM public.users
    WHERE wallet_address = user_wallet;
    
    IF user_uuid IS NULL THEN
      INSERT INTO public.users (wallet_address, created_at, updated_at)
      VALUES (user_wallet, NOW(), NOW())
      RETURNING id INTO user_uuid;
    END IF;
    
    -- Record the payment
    INSERT INTO public.payments (
      user_id,
      transaction_signature,
      amount_sol,
      amount_eur,
      plan_name,
      billing_period,
      status,
      confirmed_at,
      created_at
    ) VALUES (
      user_uuid,
      payment_signature,
      amount_sol,
      amount_eur,
      plan_name,
      billing_period,
      'confirmed',
      NOW(),
      NOW()
    ) RETURNING id INTO payment_uuid;
    
    -- Upgrade the subscription
    SELECT upgrade_user_subscription(user_uuid, plan_name, billing_period) INTO success;
    
    IF success THEN
      COMMIT;
      RETURN TRUE;
    ELSE
      ROLLBACK;
      RETURN FALSE;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    ROLLBACK;
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
