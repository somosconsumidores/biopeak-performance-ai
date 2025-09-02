-- Insert the annual Stripe price ID into app_settings
DO $$
BEGIN
  -- Try to update if it exists
  UPDATE public.app_settings
  SET setting_value = 'price_1S2h3wI6QbtlS9WtsiG7V8qD', updated_at = now()
  WHERE setting_key = 'stripe_price_annual_id';

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.app_settings (setting_key, setting_value)
    VALUES ('stripe_price_annual_id', 'price_1S2h3wI6QbtlS9WtsiG7V8qD');
  END IF;
END$$;