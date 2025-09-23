# RevenueCat In-App Purchase Setup Guide

## ✅ Implemented Features

1. **RevenueCat API Key Configuration** - Environment variable setup
2. **useSubscription Hook Updated** - Now checks RevenueCat for iOS native users
3. **RevenueCat Webhook** - Already configured to sync subscription status
4. **Database Schema** - Updated to track RevenueCat user IDs

## 🔧 Next Steps (You Need to Do These)

### 1. Configure RevenueCat API Key

1. Go to your RevenueCat Dashboard
2. Navigate to **API Keys** section
3. Copy your **Public App-specific API Key** for iOS
4. Update `.env.local` file:
   ```
   VITE_REVENUECAT_API_KEY=appl_YOUR_ACTUAL_API_KEY_HERE
   ```

### 2. Configure Products in RevenueCat Dashboard

1. **Create Products:**
   - Monthly Plan: `monthly_premium`
   - Annual Plan: `annual_premium`

2. **Create Entitlements:**
   - Create an entitlement called `premium`
   - Attach both products to this entitlement

3. **Configure Webhooks:**
   - Add webhook URL: `https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/revenuecat-webhook`
   - Enable events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`

### 3. Configure App Store Connect

1. **Create In-App Purchases:**
   - Monthly: Auto-Renewable Subscription
   - Annual: Auto-Renewable Subscription
   - Use same Product IDs as RevenueCat

2. **Configure Subscription Groups**
3. **Add App Store Server Notifications** (optional but recommended)

### 4. Test the Integration

1. **Build and install on device:**
   ```bash
   npm run build
   npx cap sync ios
   npx cap run ios
   ```

2. **Test Purchase Flow:**
   - Navigate to `/paywall` 
   - Try purchasing premium
   - Should now use App Store instead of Stripe

3. **Test Restore Purchases:**
   - Use "Restore Purchases" button
   - Should restore previous purchases

## 🔄 How It Works Now

### iOS Native Flow:
1. User taps "Upgrade to Premium" → **RevenueCat handles purchase**
2. Purchase completed → **App Store processes payment**
3. RevenueCat webhook → **Updates Supabase database**
4. App checks subscription → **RevenueCat CustomerInfo + Supabase fallback**

### Web/PWA Flow:
1. User taps "Upgrade to Premium" → **Stripe Checkout**
2. Payment completed → **Stripe processes payment**
3. Stripe webhook → **Updates Supabase database**
4. App checks subscription → **Supabase edge function**

## 🧪 Testing Commands

```bash
# Test on iOS Simulator
npx cap run ios

# Check logs
npx cap open ios
# Then view Xcode console for RevenueCat logs

# Test on physical device (recommended for IAP)
# Build → Archive → TestFlight → Install
```

## 🐛 Troubleshooting

- **"No offerings available"** → Check RevenueCat products configuration
- **"Purchase failed"** → Verify App Store Connect setup
- **"Sandbox user required"** → Create/use App Store sandbox user
- **API key error** → Verify `.env.local` has correct RevenueCat key

## 🎯 Expected Result

When you run the app on iPhone and tap "Upgrade to Premium":
- ✅ Shows App Store purchase dialog (not Stripe)
- ✅ Processes payment through App Store
- ✅ Updates subscription status in real-time
- ✅ Unlocks premium features immediately