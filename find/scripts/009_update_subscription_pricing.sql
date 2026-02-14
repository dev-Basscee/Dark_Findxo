-- Update subscription plan pricing to match user requirements
UPDATE subscription_plans 
SET 
  monthly_price_eur = 300,
  yearly_price_eur = 2500
WHERE name = 'investigator';

UPDATE subscription_plans 
SET 
  monthly_price_eur = 1000,
  yearly_price_eur = 12000
WHERE name = 'pro';
