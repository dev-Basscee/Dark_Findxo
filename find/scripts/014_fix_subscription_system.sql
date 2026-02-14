-- Fix subscription system issues

-- First, let's fix the get_current_subscription function to handle edge cases better
CREATE OR REPLACE FUNCTION get_current_subscription(user_uuid UUID)
RETURNS TABLE(
  plan_name TEXT,
  daily_requests INTEGER,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- First try to get active subscription
  RETURN QUERY
  SELECT 
    sp.name,
    sp.daily_requests,
    us.status,
    us.expires_at
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_uuid 
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no active subscription found, return free plan
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      sp.name,
      sp.daily_requests,
      'active'::TEXT as status,
      NULL::TIMESTAMP WITH TIME ZONE as expires_at
    FROM public.subscription_plans sp
    WHERE sp.name = 'free'
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the create_default_subscription function to handle duplicates
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create if user doesn't already have a subscription
  IF NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions 
    WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, starts_at)
    SELECT NEW.id, sp.id, 'active', NOW()
    FROM public.subscription_plans sp
    WHERE sp.name = 'free';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to upgrade subscription (handles existing subscriptions properly)
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
  -- Get the plan ID
  SELECT id INTO plan_uuid
  FROM public.subscription_plans
  WHERE name = new_plan_name;
  
  IF plan_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate expiry date
  IF billing_period = 'monthly' THEN
    expires_date := NOW() + INTERVAL '1 month';
  ELSE
    expires_date := NOW() + INTERVAL '1 year';
  END IF;
  
  -- Deactivate existing subscriptions
  UPDATE public.user_subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = user_uuid AND status = 'active';
  
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
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to check if user has valid subscription for API usage
CREATE OR REPLACE FUNCTION check_user_api_limit(user_uuid UUID)
RETURNS TABLE(
  can_make_request BOOLEAN,
  daily_limit INTEGER,
  current_usage INTEGER,
  plan_name TEXT
) AS $$
DECLARE
  user_sub RECORD;
  today_usage INTEGER;
BEGIN
  -- Get current subscription
  SELECT * INTO user_sub
  FROM get_current_subscription(user_uuid)
  LIMIT 1;
  
  -- Get today's usage
  SELECT COALESCE(SUM(request_count), 0) INTO today_usage
  FROM public.api_usage
  WHERE user_id = user_uuid AND date = CURRENT_DATE;
  
  -- Return the result
  RETURN QUERY
  SELECT 
    (today_usage < user_sub.daily_requests) as can_make_request,
    user_sub.daily_requests as daily_limit,
    today_usage as current_usage,
    user_sub.plan_name as plan_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have a subscription
INSERT INTO public.user_subscriptions (user_id, plan_id, status, starts_at, created_at, updated_at)
SELECT 
  u.id,
  sp.id,
  'active',
  NOW(),
  NOW(),
  NOW()
FROM public.users u
CROSS JOIN public.subscription_plans sp
WHERE sp.name = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us 
    WHERE us.user_id = u.id
  );
