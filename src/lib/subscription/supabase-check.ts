import { supabase } from '@/integrations/supabase/client';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string | null;
  subscription_type?: string;
}

/**
 * Fast Supabase-only subscription check.
 * Used for Stripe subscribers on iOS to avoid unnecessary RevenueCat calls.
 */
export async function checkSupabaseSubscription(userId: string): Promise<SubscriptionData> {
  try {
    // Add aggressive timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Direct Supabase check timeout after 5s')), 5000)
    );
    
    const queryPromise = supabase
      .from('subscribers')
      .select('subscribed, subscription_tier, subscription_end, subscription_type')
      .eq('user_id', userId)
      .maybeSingle();
    
    const { data } = await Promise.race([queryPromise, timeoutPromise]);

    if (!data || !data.subscribed) {
      return { subscribed: false };
    }

    const now = new Date();
    const isActive = data.subscribed && 
      (!data.subscription_end || new Date(data.subscription_end) > now);

    return {
      subscribed: isActive,
      subscription_tier: data.subscription_tier,
      subscription_end: data.subscription_end,
      subscription_type: data.subscription_type
    };
  } catch (error) {
    console.error('Failed to check Supabase subscription:', error);
    return { subscribed: false };
  }
}
