#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import "App-Swift.h"

CAP_PLUGIN(BioPeakHealthKit, "BioPeakHealthKit",
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkouts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkoutRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryWorkoutSeries, CAPPluginReturnPromise);
)
