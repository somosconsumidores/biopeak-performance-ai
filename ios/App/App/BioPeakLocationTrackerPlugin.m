#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BioPeakLocationTracker, "BioPeakLocationTracker",
    CAP_PLUGIN_METHOD(startLocationTracking, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopLocationTracking, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getAccumulatedDistance, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(resetDistance, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(configureFeedback, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(generateCompletionAudio, CAPPluginReturnPromise);
)
