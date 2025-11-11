package com.biopeakai.performance;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("MainActivity", "✅ onCreate called - Capacitor bridge initializing");
        
        // Register custom LOCAL plugins (required for non-npm plugins)
        registerPlugin(BioPeakAudioSession.class);
        Log.d("MainActivity", "✅ Registered BioPeakAudioSession plugin");
        
        registerPlugin(BioPeakLocationTracker.class);
        Log.d("MainActivity", "✅ Registered BioPeakLocationTracker plugin");
    }
}
