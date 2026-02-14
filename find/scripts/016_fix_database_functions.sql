-- Fix database functions to handle edge cases better

-- Improved process_payment_and_subscription function with better error handling
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
  plan_uuid UUID;
  success BOOLEAN := FALSE;
BEGIN
  -- Start transaction
  BEGIN
    -- Validate inputs
    IF payment_signature IS NULL OR user_wallet IS NULL OR plan_name IS NULL OR billing_period IS NULL THEN
      RAISE EXCEPTION 'Missing required parameters';
    END IF;

    -- Check if payment already exists
    IF EXISTS (SELECT 1 FROM public.payments WHERE transaction_signature = payment_signature) THEN
      RAISE EXCEPTION 'Payment with signature % already exists', payment_signature;
    END IF;

    -- Get plan ID
    SELECT id INTO plan_uuid
    FROM public.subscription_plans
    WHERE name = plan_name;
    
    IF plan_uuid IS NULL THEN
      RAISE EXCEPTION 'Invalid plan name: %', plan_name;
    END IF;

    -- Get or create user
    SELECT id INTO user_uuid
    FROM public.users
    WHERE wallet_address = user_wallet;
    
    IF user_uuid IS NULL THEN
      INSERT INTO public.users (wallet_address, created_at, updated_at)
      VALUES (user_wallet, NOW(), NOW())
      RETURNING id INTO user_uuid;
      
      RAISE NOTICE 'Created new user with ID: %', user_uuid;
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
    
    RAISE NOTICE 'Created payment record with ID: %', payment_uuid;
    
    -- Upgrade the subscription
    SELECT upgrade_user_subscription(user_uuid, plan_name, billing_period) INTO success;
    
    IF success THEN
      RAISE NOTICE 'Successfully upgraded subscription for user: %', user_uuid;
      RETURN TRUE;
    ELSE
      RAISE EXCEPTION 'Failed to upgrade subscription for user: %', user_uuid;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Payment processing failed: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improved upgrade_user_subscription function
CREATE OR REPLACE FUNCTION upgrade_user_subscription(
  user_uuid UUID,
  new_plan_name TEXT,
  billing_period TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  plan_uuid UUID;
  expires_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validate inputs
  IF user_uuid IS NULL OR new_plan_name IS NULL OR billing_period IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters for subscription upgrade';
  END IF;

  -- Get the plan ID
  SELECT id INTO plan_uuid
  FROM public.subscription_plans
  WHERE name = new_plan_name;
  
  IF plan_uuid IS NULL THEN
    RAISE EXCEPTION 'Invalid plan name: %', new_plan_name;
  END IF;
  
  -- Calculate expiry date
  IF billing_period = 'monthly' THEN
    expires_date := NOW() + INTERVAL '1 month';
  ELSIF billing_period = 'yearly' THEN
    expires_date := NOW() + INTERVAL '1 year';
  ELSE
    RAISE EXCEPTION 'Invalid billing period: %', billing_period;
  END IF;
  
  -- Deactivate existing subscriptions
  UPDATE public.user_subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = user_uuid AND status = 'active';
  
  RAISE NOTICE 'Deactivated existing subscriptions for user: %', user_uuid;
  
  -- Create new subscription
  INSERT INTO public.user_subscriptions (
    user_id, 
    plan_id, 
    status, 
    starts_at, 
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    user_uuid,
    plan_uuid,
    'active',
    NOW(),
    expires_date,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Created new subscription for user: % with plan: % expires: %', user_uuid, new_plan_name, expires_date;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
