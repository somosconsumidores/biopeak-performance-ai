package com.biopeakai.performance;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.onesignal.OneSignal;
import com.onesignal.debug.LogLevel;
import com.onesignal.notifications.INotificationClickEvent;
import com.onesignal.notifications.INotificationClickListener;
import com.onesignal.user.subscriptions.IPushSubscription;

@CapacitorPlugin(name = "BioPeakOneSignal")
public class BioPeakOneSignal extends Plugin {
    private static final String TAG = "BP/OneSignal";
    private static final String ONESIGNAL_APP_ID = "0b2d8fc7-218e-4f5d-a8c2-8aec54b51f38";
    private boolean isInitialized = false;

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "BioPeakOneSignal plugin loaded");
        initializeOneSignal();
    }

    private void initializeOneSignal() {
        if (isInitialized) {
            Log.i(TAG, "OneSignal already initialized");
            return;
        }

        try {
            Log.i(TAG, "Initializing OneSignal with App ID: " + ONESIGNAL_APP_ID);
            
            // Enable verbose logging for debugging (disable in production)
            OneSignal.getDebug().setLogLevel(LogLevel.VERBOSE);
            
            // Initialize OneSignal
            OneSignal.initWithContext(getContext(), ONESIGNAL_APP_ID);
            
            // Set up notification click listener
            OneSignal.getNotifications().addClickListener(new INotificationClickListener() {
                @Override
                public void onClick(INotificationClickEvent event) {
                    Log.i(TAG, "Notification clicked: " + event.getNotification().getTitle());
                    
                    // Notify JavaScript side
                    JSObject data = new JSObject();
                    data.put("title", event.getNotification().getTitle());
                    data.put("body", event.getNotification().getBody());
                    
                    // Get additional data if present
                    org.json.JSONObject additionalData = event.getNotification().getAdditionalData();
                    if (additionalData != null) {
                        data.put("additionalData", additionalData.toString());
                    }
                    
                    notifyListeners("notificationClicked", data);
                }
            });
            
            isInitialized = true;
            Log.i(TAG, "✅ OneSignal initialized successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error initializing OneSignal: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        initializeOneSignal();
        
        JSObject result = new JSObject();
        result.put("success", isInitialized);
        call.resolve(result);
    }

    @PluginMethod
    public void login(PluginCall call) {
        String userId = call.getString("userId");
        
        if (userId == null || userId.isEmpty()) {
            call.reject("userId is required");
            return;
        }

        try {
            Log.i(TAG, "Setting external user ID (login): " + userId);
            OneSignal.login(userId);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
            Log.i(TAG, "✅ User logged in successfully: " + userId);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error logging in user: " + e.getMessage(), e);
            call.reject("Failed to login: " + e.getMessage());
        }
    }

    @PluginMethod
    public void logout(PluginCall call) {
        try {
            Log.i(TAG, "Logging out user from OneSignal");
            OneSignal.logout();
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
            Log.i(TAG, "✅ User logged out successfully");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error logging out: " + e.getMessage(), e);
            call.reject("Failed to logout: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPlayerId(PluginCall call) {
        try {
            IPushSubscription subscription = OneSignal.getUser().getPushSubscription();
            String playerId = subscription.getId();
            
            Log.i(TAG, "Getting player ID: " + playerId);
            
            JSObject result = new JSObject();
            result.put("playerId", playerId);
            result.put("token", subscription.getToken());
            result.put("optedIn", subscription.getOptedIn());
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error getting player ID: " + e.getMessage(), e);
            call.reject("Failed to get player ID: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            Log.i(TAG, "Requesting notification permission");
            
            // Request permission - this is async but we'll return immediately
            // The actual permission result should be handled via listeners
            OneSignal.getNotifications().requestPermission(true, continuation -> {
                Log.i(TAG, "Permission request completed: " + OneSignal.getNotifications().getPermission());
                return null;
            });
            
            // Return current permission state
            boolean hasPermission = OneSignal.getNotifications().getPermission();
            
            JSObject result = new JSObject();
            result.put("granted", hasPermission);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error requesting permission: " + e.getMessage(), e);
            call.reject("Failed to request permission: " + e.getMessage());
        }
    }

    @PluginMethod
    public void addTags(PluginCall call) {
        try {
            JSObject tags = call.getObject("tags");
            if (tags == null) {
                call.reject("tags object is required");
                return;
            }

            Log.i(TAG, "Adding tags: " + tags.toString());
            
            java.util.Iterator<String> keys = tags.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = tags.getString(key);
                if (value != null) {
                    OneSignal.getUser().addTag(key, value);
                }
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error adding tags: " + e.getMessage(), e);
            call.reject("Failed to add tags: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        try {
            boolean hasPermission = OneSignal.getNotifications().getPermission();
            
            JSObject result = new JSObject();
            result.put("granted", hasPermission);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error getting permission status: " + e.getMessage(), e);
            call.reject("Failed to get permission status: " + e.getMessage());
        }
    }
}
