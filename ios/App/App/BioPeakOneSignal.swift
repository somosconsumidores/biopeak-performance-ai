import Foundation
import Capacitor
import OneSignalFramework

@objc(BioPeakOneSignal)
public class BioPeakOneSignal: CAPPlugin, CAPBridgedPlugin {
    
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
    private let ONESIGNAL_APP_ID = "0b2d8fc7-218e-4f5d-a8c2-8aec54b51f38"
    
    private var isInitialized = false
    private var currentExternalId: String? = nil
    private var pendingExternalId: String? = nil
    
    // Polling control
    private var pollingTimer: Timer?
    private var pollingAttempts = 0
    private let maxPollingAttempts = 33  // ~10 seconds (33 * 300ms)
    private let pollingInterval: TimeInterval = 0.3  // 300ms
    
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
            
            // Initialize OneSignal (no observers - using polling instead for SDK 5.x compatibility)
            OneSignal.initialize(self.ONESIGNAL_APP_ID, withLaunchOptions: nil)
            
            self.isInitialized = true
            print("📱 [\(self.TAG)] ✅ OneSignal initialized successfully (polling mode)")
            
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
            print("📱 [\(TAG)] ⚠️ Subscription not ready yet, storing pending externalId and starting polling")
            pendingExternalId = externalId
            
            // Start polling to wait for subscription
            DispatchQueue.main.async { [weak self] in
                self?.startPollingForSubscription()
            }
            
            call.resolve([
                "success": true,
                "message": "Stored pending external ID - subscription not ready, polling started"
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
        
        stopPolling()
        
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
                    
                    // Start polling to detect when subscription is ready
                    DispatchQueue.main.async {
                        self.startPollingForSubscription()
                    }
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
    
    // MARK: - Subscription Polling (SDK 5.x compatible approach)
    
    private func startPollingForSubscription() {
        stopPolling()
        pollingAttempts = 0
        
        print("📱 [\(TAG)] 🔄 Starting subscription polling...")
        
        pollingTimer = Timer.scheduledTimer(withTimeInterval: pollingInterval, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            
            self.pollingAttempts += 1
            
            let subscriptionId = OneSignal.User.pushSubscription.id
            let optedIn = OneSignal.User.pushSubscription.optedIn
            let token = OneSignal.User.pushSubscription.token
            
            print("📱 [\(self.TAG)] 🔄 Polling attempt \(self.pollingAttempts)/\(self.maxPollingAttempts) - id: \(subscriptionId ?? "nil"), optedIn: \(optedIn), token: \(token != nil ? "exists" : "nil")")
            
            // Subscription is ready when we have an ID and optedIn is true
            if let subId = subscriptionId, !subId.isEmpty, optedIn {
                self.stopPolling()
                self.onSubscriptionReady(subscriptionId: subId, optedIn: optedIn, token: token)
                return
            }
            
            // Timeout
            if self.pollingAttempts >= self.maxPollingAttempts {
                self.stopPolling()
                print("📱 [\(self.TAG)] ⚠️ Polling timeout - subscription not ready after \(self.maxPollingAttempts) attempts")
                self.notifyListeners("subscriptionTimeout", data: [:])
            }
        }
    }
    
    private func stopPolling() {
        pollingTimer?.invalidate()
        pollingTimer = nil
    }
    
    private func onSubscriptionReady(subscriptionId: String, optedIn: Bool, token: String?) {
        print("📱 [\(TAG)] ✅ Subscription ready: id=\(subscriptionId), optedIn=\(optedIn), hasToken=\(token != nil)")
        
        // Notify JS
        notifyListeners("subscriptionChange", data: [
            "subscriptionId": subscriptionId,
            "optedIn": optedIn,
            "token": token as Any,
            "hasToken": token != nil
        ])
        
        // If we have a pending external ID and subscription is ready, login now
        if let externalId = pendingExternalId, optedIn {
            print("📱 [\(TAG)] 🔧 Subscription ready with pending externalId, logging in...")
            
            OneSignal.login(externalId)
            currentExternalId = externalId
            pendingExternalId = nil
            
            print("📱 [\(TAG)] ✅ Login completed for: \(externalId.prefix(8))...")
        }
    }
}
