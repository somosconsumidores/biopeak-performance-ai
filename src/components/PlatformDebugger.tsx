import { useSubscription } from '@/hooks/useSubscription';
import { usePlatform } from '@/hooks/usePlatform';
import { useAuth } from '@/hooks/useAuth';

export const PlatformDebugger = () => {
  const { isSubscribed, loading, subscriptionTier, subscriptionEnd } = useSubscription();
  const { platform, isNative, isIOS, isAndroid, isWeb } = usePlatform();
  const { user } = useAuth();

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-background/90 backdrop-blur-sm border rounded-lg shadow-lg text-xs max-w-sm z-50">
      <h3 className="font-semibold mb-2 text-primary">Debug Info</h3>
      
      <div className="space-y-1">
        <div><strong>Platform:</strong> {platform}</div>
        <div><strong>Native:</strong> {isNative ? '✅' : '❌'}</div>
        <div><strong>iOS:</strong> {isIOS ? '✅' : '❌'}</div>
        <div><strong>Android:</strong> {isAndroid ? '✅' : '❌'}</div>
        <div><strong>Web:</strong> {isWeb ? '✅' : '❌'}</div>
      </div>

      <div className="mt-3 pt-2 border-t">
        <div><strong>User ID:</strong> {user?.id?.slice(0, 8) || 'None'}...</div>
        <div><strong>Subscription Loading:</strong> {loading ? '⏳' : '✅'}</div>
        <div><strong>Is Subscribed:</strong> {isSubscribed ? '✅ YES' : '❌ NO'}</div>
        <div><strong>Tier:</strong> {subscriptionTier || 'None'}</div>
        <div><strong>Ends:</strong> {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'None'}</div>
      </div>

      <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground">
        Current Route: {window.location.pathname}
      </div>
    </div>
  );
};