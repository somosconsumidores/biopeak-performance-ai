import { supabase } from '@/integrations/supabase/client';

export type SubscriptionSource = 'revenuecat' | 'stripe' | 'none';

/**
 * Detects the subscription source for a user by checking the subscribers table.
 * This helps determine whether to use RevenueCat or Stripe for subscription verification.
 */
export async function detectSubscriptionSource(userId: string): Promise<SubscriptionSource> {
  try {
    const { data: subscriber } = await supabase
      .from('subscribers')
      .select('subscription_type, subscription_source, subscribed, revenuecat_user_id, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!subscriber || !subscriber.subscribed) {
      return 'none';
    }

    // Priority 1: Check explicit subscription_source column (if exists)
    if (subscriber.subscription_source === 'revenuecat') {
      return 'revenuecat';
    }
    if (subscriber.subscription_source === 'stripe') {
      return 'stripe';
    }

    // Priority 2: Check for RevenueCat user ID
    if (subscriber.revenuecat_user_id) {
      return 'revenuecat';
    }

    // Priority 3: Check for Stripe customer ID
    if (subscriber.stripe_customer_id) {
      return 'stripe';
    }

    // Priority 4: Infer from subscription_type
    if (subscriber.subscription_type === 'ios') {
      return 'revenuecat';
    }

    if (['stripe', 'annual', 'monthly', 'trial'].includes(subscriber.subscription_type || '')) {
      return 'stripe';
    }

    // Default: assume none if can't determine
    return 'none';
  } catch (error) {
    console.error('Failed to detect subscription source:', error);
    return 'none';
  }
}
