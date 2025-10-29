-- Add subscription_source column to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS subscription_source TEXT 
CHECK (subscription_source IN ('stripe', 'revenuecat', 'auto'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscribers_subscription_source 
ON public.subscribers(subscription_source);

-- Update existing records to set the correct source
UPDATE public.subscribers 
SET subscription_source = CASE
  WHEN revenuecat_user_id IS NOT NULL THEN 'revenuecat'
  WHEN stripe_customer_id IS NOT NULL THEN 'stripe'
  ELSE 'auto'
END
WHERE subscription_source IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.subscribers.subscription_source IS 
'Indicates the source of the subscription: stripe (Stripe customer), revenuecat (RevenueCat/iOS), or auto (automatically determined)';
