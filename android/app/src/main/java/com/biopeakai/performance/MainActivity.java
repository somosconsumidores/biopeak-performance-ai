package com.biopeakai.performance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom LOCAL plugins (required for non-npm plugins)
        registerPlugin(BioPeakAudioSession.class);
        registerPlugin(BioPeakLocationTracker.class);
    }
}
