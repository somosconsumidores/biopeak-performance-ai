-- Insert environment-specific Stripe price ID settings for better key/price management
-- This allows setting different price IDs for test and live environments

INSERT INTO public.app_settings (setting_key, setting_value, created_at, updated_at) 
VALUES 
  ('stripe_price_monthly_id_test', NULL, now(), now()),
  ('stripe_price_monthly_id_live', NULL, now(), now()),
  ('stripe_price_annual_id_test', NULL, now(), now()),
  ('stripe_price_annual_id_live', NULL, now(), now())
ON CONFLICT (setting_key) DO NOTHING;