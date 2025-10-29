import { revenueCat } from '@/lib/revenuecat';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string | null;
}

export async function checkRevenueCatLight(userId: string): Promise<SubscriptionData> {
  try {
    // Initialize RevenueCat with user ID
    await revenueCat.initialize(userId);
    
    // Get customer info with 3s timeout
    const info = await Promise.race([
      revenueCat.getCustomerInfo(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('RevenueCat timeout')), 3000)
      )
    ]);
    
    // Check for active entitlements
    const active = info?.entitlements?.active ?? {};
    
    if (Object.keys(active).length > 0) {
      const entitlement = active[Object.keys(active)[0]];
      return {
        subscribed: entitlement.isActive,
        subscription_tier: 'premium',
        subscription_end: entitlement.expirationDate || null
      };
    }
    
    return { subscribed: false };
  } catch (error) {
    console.error('RevenueCat check failed:', error);
    throw error;
  }
}
