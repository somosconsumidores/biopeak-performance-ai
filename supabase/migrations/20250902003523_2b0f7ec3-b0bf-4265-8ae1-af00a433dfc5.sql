-- Ensure the monthly Stripe price is set correctly in app_settings
DO $$
BEGIN
  -- Try to update if it exists
  UPDATE public.app_settings
  SET setting_value = 'price_1S2h3JI6QbtlS9Wt7Wupjnco', updated_at = now()
  WHERE setting_key = 'stripe_price_monthly_id';

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.app_settings (setting_key, setting_value)
    VALUES ('stripe_price_monthly_id', 'price_1S2h3JI6QbtlS9Wt7Wupjnco');
  END IF;
END$$;