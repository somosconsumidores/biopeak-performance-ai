-- Create a RevenueCat API key environment variable in the subscribers table metadata
-- Add metadata column to subscribers table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscribers' AND column_name = 'metadata') THEN
        ALTER TABLE public.subscribers ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add RevenueCat user ID tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscribers' AND column_name = 'revenuecat_user_id') THEN
        ALTER TABLE public.subscribers ADD COLUMN revenuecat_user_id TEXT NULL;
    END IF;
END $$;