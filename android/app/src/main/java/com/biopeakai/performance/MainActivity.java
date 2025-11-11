package com.biopeakai.performance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(BioPeakAudioSession.class);
        registerPlugin(BioPeakLocationTracker.class);
    }
}
