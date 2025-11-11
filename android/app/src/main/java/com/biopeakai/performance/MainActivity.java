package com.biopeakai.performance;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

import com.biopeakai.performance.BioPeakAudioSession;
import com.biopeakai.performance.BioPeakLocationTracker;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "🔧 Registering inline plugins...");
        registerPlugin(BioPeakAudioSession.class);
        registerPlugin(BioPeakLocationTracker.class);
        Log.d(TAG, "✅ Inline plugins registered successfully");
    }
}
