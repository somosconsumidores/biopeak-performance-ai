#import <Capacitor/Capacitor.h>

// Registrar o plugin Swift no Capacitor
CAP_PLUGIN(BioPeakHealthKit, "BioPeakHealthKit",
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkouts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkoutRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkoutSeries, CAPPluginReturnPromise);
);

