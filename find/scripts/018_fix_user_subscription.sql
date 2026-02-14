-- Fix subscription for user with wallet Dc3QQVbiBBk8NCF69kcDSerNVMrZoKbg2KBz1NofsXjs
-- Update to investigator plan with 1 month expiration

BEGIN;

-- Get user ID and plan ID
WITH user_data AS (
  SELECT id FROM public.users 
  WHERE wallet_address = 'Dc3QQVbiBBk8NCF69kcDSerNVMrZoKbg2KBz1NofsXjs'
),
plan_data AS (
  SELECT id FROM public.subscription_plans 
  WHERE name = 'investigator'
)
-- Delete existing subscriptions for this user
DELETE FROM public.user_subscriptions 
WHERE user_id = (SELECT id FROM user_data);

-- Get user ID and plan ID again for insert
WITH user_data AS (
  SELECT id FROM public.users 
  WHERE wallet_address = 'Dc3QQVbiBBk8NCF69kcDSerNVMrZoKbg2KBz1NofsXjs'
),
plan_data AS (
  SELECT id FROM public.subscription_plans 
  WHERE name = 'investigator'
)
-- Insert new subscription with 1 month expiration
INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at, created_at)
VALUES (
  (SELECT id FROM user_data),
  (SELECT id FROM plan_data),
  'active',
  NOW() + INTERVAL '1 month',
  NOW()
);

COMMIT;

-- Verify the update
SELECT 
  u.wallet_address,
  sp.name as plan_name,
  us.status,
  us.expires_at,
  us.created_at
FROM public.user_subscriptions us
JOIN public.users u ON us.user_id = u.id
JOIN public.subscription_plans sp ON us.plan_id = sp.id
WHERE u.wallet_address = 'Dc3QQVbiBBk8NCF69kcDSerNVMrZoKbg2KBz1NofsXjs';
