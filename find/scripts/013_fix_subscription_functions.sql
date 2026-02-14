-- Updated get_current_subscription function to handle edge cases better
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
  
  -- If no active subscription found, return free plan as default
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

-- Function to ensure user has a default subscription
CREATE OR REPLACE FUNCTION ensure_user_subscription(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if user has any subscription
  IF NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions 
    WHERE user_id = user_uuid
  ) THEN
    -- Create free subscription if none exists
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, starts_at)
    SELECT user_uuid, sp.id, 'active', NOW()
    FROM public.subscription_plans sp
    WHERE sp.name = 'free';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger to use the new function
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_subscription(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
