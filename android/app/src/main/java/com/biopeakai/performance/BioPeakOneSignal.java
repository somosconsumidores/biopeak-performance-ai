package com.biopeakai.performance;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.onesignal.Continue;
import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.IPermissionObserver;
import com.onesignal.user.subscriptions.IPushSubscriptionObserver;
import com.onesignal.user.subscriptions.PushSubscriptionChangedState;

@CapacitorPlugin(name = "BioPeakOneSignal")
public class BioPeakOneSignal extends Plugin implements IPermissionObserver, IPushSubscriptionObserver {
    private static final String TAG = "BP/OneSignal";
    private boolean isInitialized = false;
    private String currentExternalId = null;

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "🔔 BioPeakOneSignal plugin loaded");
        
        // Auto-initialize on load
        initializeOneSignal();
    }

    private void initializeOneSignal() {
        if (isInitialized) {
            Log.d(TAG, "⚠️ OneSignal already initialized");
            return;
        }

        try {
            // Get App ID from AndroidManifest meta-data
            String appId = getAppIdFromManifest();
            if (appId == null || appId.isEmpty() || appId.equals("YOUR_ONESIGNAL_APP_ID")) {
                Log.e(TAG, "❌ OneSignal App ID not configured in AndroidManifest.xml");
                return;
            }

            Log.d(TAG, "🔔 Initializing OneSignal with App ID: " + appId.substring(0, 8) + "...");

            // Enable verbose logging in debug builds
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);

            // Initialize OneSignal
            OneSignal.initWithContext(getContext(), appId);

            // Add observers
            OneSignal.getNotifications().addPermissionObserver(this);
            OneSignal.getUser().getPushSubscription().addObserver(this);

            isInitialized = true;
            Log.d(TAG, "✅ OneSignal initialized successfully");

        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to initialize OneSignal", e);
        }
    }

    private String getAppIdFromManifest() {
        try {
            ApplicationInfo appInfo = getContext().getPackageManager()
                    .getApplicationInfo(getContext().getPackageName(), PackageManager.GET_META_DATA);
            Bundle metaData = appInfo.metaData;
            if (metaData != null) {
                return metaData.getString("com.onesignal.appId");
            }
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "❌ Failed to read meta-data", e);
        }
        return null;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "📱 initialize() called");
        
        if (!isInitialized) {
            initializeOneSignal();
        }

        JSObject result = new JSObject();
        result.put("success", isInitialized);
        result.put("message", isInitialized ? "OneSignal initialized" : "Failed to initialize");
        call.resolve(result);
    }

    @PluginMethod
    public void login(PluginCall call) {
        String externalId = call.getString("externalId");
        Log.d(TAG, "📱 login() called with externalId: " + (externalId != null ? externalId.substring(0, 8) + "..." : "null"));

        if (externalId == null || externalId.isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "externalId is required");
            call.resolve(result);
            return;
        }

        if (!isInitialized) {
            initializeOneSignal();
        }

        try {
            OneSignal.login(externalId);
            currentExternalId = externalId;
            
            // Ensure user is opted-in immediately after login if permission already exists
            try {
                boolean hasPermission = OneSignal.getNotifications().getPermission();
                if (hasPermission) {
                    Log.d(TAG, "📱 Permission already granted, opting in after login...");
                    OneSignal.getUser().getPushSubscription().optIn();
                    Log.d(TAG, "✅ Push subscription opted in after login");
                }
            } catch (Exception e) {
                Log.e(TAG, "⚠️ Failed to opt-in after login", e);
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Logged in with external ID");
            result.put("externalId", externalId);
            call.resolve(result);
            
            Log.d(TAG, "✅ OneSignal login successful");
        } catch (Exception e) {
            Log.e(TAG, "❌ OneSignal login failed", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void logout(PluginCall call) {
        Log.d(TAG, "📱 logout() called");

        try {
            OneSignal.logout();
            currentExternalId = null;
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Logged out");
            call.resolve(result);
            
            Log.d(TAG, "✅ OneSignal logout successful");
        } catch (Exception e) {
            Log.e(TAG, "❌ OneSignal logout failed", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Log.d(TAG, "📱 requestPermission() called");

        if (!isInitialized) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("granted", false);
            result.put("message", "OneSignal not initialized");
            call.resolve(result);
            return;
        }

        try {
            // Check current permission status first
            boolean alreadyGranted = OneSignal.getNotifications().getPermission();
            
            if (alreadyGranted) {
                Log.d(TAG, "📱 Permission already granted, ensuring opt-in...");
                
                // Ensure user is opted into push subscription even if permission was already granted
                try {
                    OneSignal.getUser().getPushSubscription().optIn();
                    Log.d(TAG, "✅ Push subscription opted in (permission was already granted)");
                } catch (Exception e) {
                    Log.e(TAG, "⚠️ Failed to opt-in to push subscription", e);
                }
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("granted", true);
                result.put("message", "Permission already granted");
                call.resolve(result);
                return;
            }
            
            // Request permission using Continue.with() for Java compatibility with Kotlin suspend functions
            OneSignal.getNotifications().requestPermission(true, Continue.with(r -> {
                if (r.isSuccess()) {
                    Boolean granted = r.getData();
                    boolean isGranted = granted != null && granted;
                    Log.d(TAG, "📱 Permission result: " + isGranted);
                    
                    // Explicitly opt-in to push subscription after permission is granted
                    if (isGranted) {
                        try {
                            OneSignal.getUser().getPushSubscription().optIn();
                            Log.d(TAG, "✅ Push subscription opted in");
                        } catch (Exception e) {
                            Log.e(TAG, "⚠️ Failed to opt-in to push subscription", e);
                        }
                    }
                    
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("granted", isGranted);
                    result.put("message", isGranted ? "Permission granted" : "Permission denied");
                    call.resolve(result);
                } else {
                    Throwable error = r.getThrowable();
                    Log.e(TAG, "❌ Permission request failed", error);
                    
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("granted", false);
                    result.put("message", error != null ? error.getMessage() : "Permission request failed");
                    call.resolve(result);
                }
            }));
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to request permission", e);
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("granted", false);
            result.put("message", e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        Log.d(TAG, "📱 getPermissionStatus() called");

        boolean hasPermission = false;
        if (isInitialized) {
            hasPermission = OneSignal.getNotifications().getPermission();
        }

        JSObject result = new JSObject();
        result.put("granted", hasPermission);
        result.put("initialized", isInitialized);
        call.resolve(result);
    }

    @PluginMethod
    public void getSubscriptionId(PluginCall call) {
        Log.d(TAG, "📱 getSubscriptionId() called");

        String subscriptionId = null;
        if (isInitialized) {
            subscriptionId = OneSignal.getUser().getPushSubscription().getId();
        }

        JSObject result = new JSObject();
        result.put("subscriptionId", subscriptionId);
        result.put("initialized", isInitialized);
        call.resolve(result);
    }

    @PluginMethod
    public void getExternalId(PluginCall call) {
        Log.d(TAG, "📱 getExternalId() called");

        JSObject result = new JSObject();
        result.put("externalId", currentExternalId);
        result.put("initialized", isInitialized);
        call.resolve(result);
    }

    @PluginMethod
    public void getFullStatus(PluginCall call) {
        Log.d(TAG, "📱 getFullStatus() called");
        
        JSObject result = new JSObject();
        result.put("initialized", isInitialized);
        result.put("currentExternalId", currentExternalId);
        
        if (isInitialized) {
            try {
                result.put("permission", OneSignal.getNotifications().getPermission());
                result.put("subscriptionId", OneSignal.getUser().getPushSubscription().getId());
                result.put("optedIn", OneSignal.getUser().getPushSubscription().getOptedIn());
                String token = OneSignal.getUser().getPushSubscription().getToken();
                result.put("token", token);
                result.put("hasToken", token != null && !token.isEmpty());
            } catch (Exception e) {
                result.put("error", e.getMessage());
            }
        }
        
        Log.d(TAG, "📱 Full status: " + result.toString());
        call.resolve(result);
    }

    // IPermissionObserver implementation
    @Override
    public void onNotificationPermissionChange(boolean permission) {
        Log.d(TAG, "🔔 Permission changed: " + permission);
        
        JSObject data = new JSObject();
        data.put("granted", permission);
        notifyListeners("permissionChange", data);
    }

    // IPushSubscriptionObserver implementation
    @Override
    public void onPushSubscriptionChange(PushSubscriptionChangedState state) {
        String subscriptionId = state.getCurrent().getId();
        boolean optedIn = state.getCurrent().getOptedIn();
        String token = state.getCurrent().getToken();
        
        Log.d(TAG, "🔔 Subscription changed - ID: " + subscriptionId + ", OptedIn: " + optedIn + ", Token: " + (token != null ? token.substring(0, Math.min(20, token.length())) + "..." : "null"));
        
        // AUTO-HEAL: Se temos subscriptionId mas não está opted-in, e permission existe, forçar opt-in
        if (subscriptionId != null && !optedIn) {
            try {
                boolean hasPermission = OneSignal.getNotifications().getPermission();
                if (hasPermission) {
                    Log.d(TAG, "🔧 Auto-healing: permission exists but not opted-in, calling optIn()...");
                    OneSignal.getUser().getPushSubscription().optIn();
                }
            } catch (Exception e) {
                Log.e(TAG, "⚠️ Auto-heal optIn failed", e);
            }
        }
        
        // AUTO-HEAL: Se temos subscriptionId, optedIn é true, token existe, e há external_id pendente, re-fazer login
        // Isso garante que o external_id seja associado corretamente à subscription ativa COM token
        if (subscriptionId != null && optedIn && token != null && !token.isEmpty() && currentExternalId != null) {
            Log.d(TAG, "🔧 Auto-healing: re-associating external_id after subscription is fully ready (has token)...");
            try {
                OneSignal.login(currentExternalId);
                Log.d(TAG, "✅ Re-login with external_id successful");
            } catch (Exception e) {
                Log.e(TAG, "⚠️ Auto-heal login failed", e);
            }
        }
        
        JSObject data = new JSObject();
        data.put("subscriptionId", subscriptionId);
        data.put("optedIn", optedIn);
        data.put("token", token);
        data.put("hasToken", token != null && !token.isEmpty());
        notifyListeners("subscriptionChange", data);
    }
}
