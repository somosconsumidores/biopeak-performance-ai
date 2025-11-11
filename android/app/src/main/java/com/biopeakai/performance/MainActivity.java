package com.biopeakai.performance;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

import com.biopeakai.performance.BioPeakAudioSession;
import com.biopeakai.performance.BioPeakLocationTracker;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BP/MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.e(TAG, "🔧 onCreate: registering plugins BEFORE super.onCreate()...");

        try {
            registerPlugin(BioPeakAudioSession.class);
            Log.e(TAG, "✅ BioPeakAudioSession registered");
        } catch (Exception e) {
            Log.e(TAG, "❌ AudioSession register FAIL", e);
        }

        try {
            Class<?> pluginClass = BioPeakLocationTracker.class;
            Log.e(TAG, "📦 Plugin class loaded: " + pluginClass.getName());
            Log.e(TAG, "📦 Plugin class package: " + pluginClass.getPackage().getName());
            
            registerPlugin(BioPeakLocationTracker.class);
            Log.e(TAG, "✅ BioPeakLocationTracker registered");
        } catch (Exception e) {
            Log.e(TAG, "❌ LocationTracker register FAIL", e);
            e.printStackTrace();
        }

        Log.e(TAG, "🔄 Now calling super.onCreate() to initialize Capacitor bridge...");
        super.onCreate(savedInstanceState);
        Log.e(TAG, "✅ MainActivity.onCreate() completed");
    }
}
