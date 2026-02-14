-- Update the investigator plan daily requests from 100 to 300
UPDATE subscription_plans 
SET daily_requests = 300 
WHERE name = 'investigator' AND daily_requests = 100;

-- Verify the update
SELECT name, daily_requests, monthly_price_eur, yearly_price_eur 
FROM subscription_plans 
WHERE name = 'investigator';
