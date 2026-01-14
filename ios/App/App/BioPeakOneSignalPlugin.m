#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BioPeakOneSignal, "BioPeakOneSignal",
    CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(login, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(logout, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getPermissionStatus, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getSubscriptionId, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getExternalId, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getFullStatus, CAPPluginReturnPromise);
)
