#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro
CAP_PLUGIN(BioPeakAudioSession, "BioPeakAudioSession",
    CAP_PLUGIN_METHOD(startAudioSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopAudioSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setAudioCategory, CAPPluginReturnPromise);
)
