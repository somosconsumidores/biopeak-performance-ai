interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string | null;
}

interface CachedData {
  data: SubscriptionData;
  timestamp: number;
  source: 'revenuecat' | 'stripe'; // Track the source of cached data
}

const CACHE_VERSION = 'ios_v1';
const LOCAL_CACHE_KEY = `subscription_cache_${CACHE_VERSION}`;
const SESSION_CACHE_KEY = `subscription_session_${CACHE_VERSION}`;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function cacheSubscription(data: SubscriptionData, source: 'revenuecat' | 'stripe' = 'stripe'): void {
  try {
    const payload: CachedData = { data, timestamp: Date.now(), source };
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(payload));
    
    // Also cache in session storage with source
    const sessionPayload = { ...data, _source: source };
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(sessionPayload));
  } catch (error) {
    console.error('Failed to cache subscription:', error);
  }
}

export function getCachedSubscription(expectedSource?: 'revenuecat' | 'stripe'): SubscriptionData | null {
  try {
    // First try session cache (current session only)
    const sessionRaw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw) as any;
      const data = parsed as SubscriptionData;
      const source = parsed._source;
      
      // Invalidate if source changed
      if (expectedSource && source && source !== expectedSource) {
        console.log(`Cache source mismatch: expected ${expectedSource}, got ${source}. Clearing cache.`);
        clearSubscriptionCache();
        return null;
      }
      
      const expired = data.subscription_end && new Date(data.subscription_end) < new Date();
      if (!expired) return data;
    }

    // Fallback to localStorage (with 24h expiration)
    const localRaw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (localRaw) {
      const { data, timestamp, source } = JSON.parse(localRaw) as CachedData;
      
      // Invalidate if source changed
      if (expectedSource && source && source !== expectedSource) {
        console.log(`Cache source mismatch: expected ${expectedSource}, got ${source}. Clearing cache.`);
        clearSubscriptionCache();
        return null;
      }
      
      const expired = data.subscription_end && new Date(data.subscription_end) < new Date();
      const tooOld = Date.now() - timestamp > CACHE_DURATION;
      
      if (!expired && !tooOld) return data;
    }
  } catch (error) {
    console.error('Failed to get cached subscription:', error);
  }
  return null;
}

export function clearSubscriptionCache(): void {
  try {
    localStorage.removeItem(LOCAL_CACHE_KEY);
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear subscription cache:', error);
  }
}
