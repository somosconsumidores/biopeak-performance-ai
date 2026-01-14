import Foundation
import Capacitor
import OneSignal

@objc(BioPeakOneSignal)
public class BioPeakOneSignal: CAPPlugin, CAPBridgedPlugin, OneSignalNotificationPermissionObserver, OneSignalPushSubscriptionObserver {
    
    public let identifier = "BioPeakOneSignal"
    public let jsName = "BioPeakOneSignal"
    
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSubscriptionId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getExternalId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFullStatus", returnType: CAPPluginReturnPromise)
    ]
    
    private let TAG = "BioPeakOneSignal"
    private let ONESIGNAL_APP_ID = "6ded5fe9-1b2e-42cb-9e0b-30f28a02f413"
    
    private var isInitialized = false
    private var currentExternalId: String? = nil
    private var pendingExternalId: String? = nil
    
    override public func load() {
        super.load()
        print("📱 [\(TAG)] Plugin loaded")
    }
    
    // MARK: - Initialize
    
    @objc func initialize(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] initialize() called")
        
        if isInitialized {
            print("📱 [\(TAG)] Already initialized")
            call.resolve([
                "success": true,
                "message": "Already initialized"
            ])
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Initialize OneSignal
            OneSignal.initialize(self.ONESIGNAL_APP_ID, withLaunchOptions: nil)
            
            // Add observers
            OneSignal.Notifications.addPermissionObserver(self)
            OneSignal.User.pushSubscription.addObserver(self)
            
            self.isInitialized = true
            print("📱 [\(self.TAG)] ✅ OneSignal initialized successfully")
            
            call.resolve([
                "success": true,
                "message": "OneSignal initialized"
            ])
        }
    }
    
    // MARK: - Login
    
    @objc func login(_ call: CAPPluginCall) {
        guard let externalId = call.getString("externalId") else {
            call.reject("externalId is required")
            return
        }
        
        print("📱 [\(TAG)] login() called with externalId: \(externalId.prefix(8))...")
        
        if !isInitialized {
            print("📱 [\(TAG)] ⚠️ Not initialized yet, storing pending externalId")
            pendingExternalId = externalId
            call.resolve([
                "success": true,
                "message": "Stored pending external ID"
            ])
            return
        }
        
        // Check if subscription is ready
        let subscriptionId = OneSignal.User.pushSubscription.id
        let optedIn = OneSignal.User.pushSubscription.optedIn
        let token = OneSignal.User.pushSubscription.token
        
        print("📱 [\(TAG)] Subscription status before login: id=\(subscriptionId ?? "nil"), optedIn=\(optedIn), token=\(token != nil ? "exists" : "nil")")
        
        if !optedIn || token == nil {
            print("📱 [\(TAG)] ⚠️ Subscription not ready yet, storing pending externalId")
            pendingExternalId = externalId
            call.resolve([
                "success": true,
                "message": "Stored pending external ID - subscription not ready"
            ])
            return
        }
        
        // Login with OneSignal
        OneSignal.login(externalId)
        currentExternalId = externalId
        pendingExternalId = nil
        
        print("📱 [\(TAG)] ✅ Logged in with external ID: \(externalId.prefix(8))...")
        
        call.resolve([
            "success": true,
            "message": "Logged in successfully",
            "externalId": externalId
        ])
    }
    
    // MARK: - Logout
    
    @objc func logout(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] logout() called")
        
        if !isInitialized {
            call.resolve([
                "success": true,
                "message": "Not initialized"
            ])
            return
        }
        
        OneSignal.logout()
        currentExternalId = nil
        pendingExternalId = nil
        
        print("📱 [\(TAG)] ✅ Logged out")
        
        call.resolve([
            "success": true,
            "message": "Logged out successfully"
        ])
    }
    
    // MARK: - Request Permission
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] requestPermission() called")
        
        if !isInitialized {
            call.reject("OneSignal not initialized")
            return
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            OneSignal.Notifications.requestPermission({ accepted in
                print("📱 [\(self.TAG)] Permission result: \(accepted)")
                
                if accepted {
                    // OptIn to ensure subscription is created
                    OneSignal.User.pushSubscription.optIn()
                    print("📱 [\(self.TAG)] ✅ Called optIn() after permission granted")
                }
                
                call.resolve([
                    "success": true,
                    "granted": accepted,
                    "message": accepted ? "Permission granted" : "Permission denied"
                ])
            }, fallbackToSettings: true)
        }
    }
    
    // MARK: - Get Permission Status
    
    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        let granted = OneSignal.Notifications.permission
        
        call.resolve([
            "granted": granted,
            "initialized": isInitialized
        ])
    }
    
    // MARK: - Get Subscription ID
    
    @objc func getSubscriptionId(_ call: CAPPluginCall) {
        let subscriptionId = isInitialized ? OneSignal.User.pushSubscription.id : nil
        
        call.resolve([
            "subscriptionId": subscriptionId as Any,
            "initialized": isInitialized
        ])
    }
    
    // MARK: - Get External ID
    
    @objc func getExternalId(_ call: CAPPluginCall) {
        call.resolve([
            "externalId": currentExternalId as Any,
            "initialized": isInitialized
        ])
    }
    
    // MARK: - Get Full Status
    
    @objc func getFullStatus(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] getFullStatus() called")
        
        var result: [String: Any] = [
            "initialized": isInitialized,
            "currentExternalId": currentExternalId as Any,
            "pendingExternalId": pendingExternalId as Any
        ]
        
        if isInitialized {
            let permission = OneSignal.Notifications.permission
            let subscriptionId = OneSignal.User.pushSubscription.id
            let optedIn = OneSignal.User.pushSubscription.optedIn
            let token = OneSignal.User.pushSubscription.token
            
            result["permission"] = permission
            result["subscriptionId"] = subscriptionId as Any
            result["optedIn"] = optedIn
            result["token"] = token as Any
            result["hasToken"] = token != nil
        }
        
        print("📱 [\(TAG)] Full status: \(result)")
        call.resolve(result)
    }
    
    // MARK: - Permission Observer
    
    public func onNotificationPermissionDidChange(_ permission: Bool) {
        print("📱 [\(TAG)] 🔔 Permission changed: \(permission)")
        
        notifyListeners("permissionChange", data: [
            "granted": permission
        ])
        
        // Auto-heal: if permission granted but not opted in, opt in
        if permission && isInitialized {
            let optedIn = OneSignal.User.pushSubscription.optedIn
            if !optedIn {
                print("📱 [\(TAG)] 🔧 Auto-healing: permission granted but not opted in, calling optIn()")
                OneSignal.User.pushSubscription.optIn()
            }
        }
    }
    
    // MARK: - Push Subscription Observer
    
    public func onPushSubscriptionDidChange(state: OSPushSubscriptionChangedState) {
        let subscriptionId = state.current.id
        let optedIn = state.current.optedIn
        let token = state.current.token
        
        print("📱 [\(TAG)] 🔔 Subscription changed - id: \(subscriptionId ?? "nil"), optedIn: \(optedIn), token: \(token != nil ? "exists" : "nil")")
        
        // Notify listeners
        notifyListeners("subscriptionChange", data: [
            "subscriptionId": subscriptionId as Any,
            "optedIn": optedIn,
            "token": token as Any,
            "hasToken": token != nil
        ])
        
        // Auto-heal: if subscription is ready and we have a pending external ID, login
        if optedIn && token != nil && pendingExternalId != nil {
            let externalId = pendingExternalId!
            print("📱 [\(TAG)] 🔧 Auto-healing: subscription ready with pending externalId, logging in...")
            
            OneSignal.login(externalId)
            currentExternalId = externalId
            pendingExternalId = nil
            
            print("📱 [\(TAG)] ✅ Auto-heal login completed for: \(externalId.prefix(8))...")
        }
    }
}
