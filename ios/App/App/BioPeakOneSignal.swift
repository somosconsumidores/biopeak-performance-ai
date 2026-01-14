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
    
    // Login retry control
    private var loginRetryCount = 0
    private let maxLoginRetries = 3
    
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
        
        // CRITICAL: Execute ALL OneSignal calls on Main Thread
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
    
    // MARK: - Login (with Main Thread + Retry Logic)
    
    @objc func login(_ call: CAPPluginCall) {
        guard let externalId = call.getString("externalId") else {
            call.reject("externalId is required")
            return
        }
        
        print("📱 [\(TAG)] login() called with externalId: \(externalId.prefix(8))...")
        
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            if !self.isInitialized {
                print("📱 [\(self.TAG)] ⚠️ Not initialized yet, storing pending externalId")
                self.pendingExternalId = externalId
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
            
            print("📱 [\(self.TAG)] Subscription status before login: id=\(subscriptionId ?? "nil"), optedIn=\(optedIn), token=\(token != nil ? "exists" : "nil")")
            
            if !optedIn || token == nil {
                print("📱 [\(self.TAG)] ⚠️ Subscription not ready yet, storing pending externalId and starting polling")
                self.pendingExternalId = externalId
                self.startPollingForSubscription()
                
                call.resolve([
                    "success": true,
                    "message": "Stored pending external ID - subscription not ready, polling started"
                ])
                return
            }
            
            // Reset retry count for new login attempt
            self.loginRetryCount = 0
            
            // Execute login with retry mechanism
            self.performLoginWithRetry(externalId: externalId) { success in
                if success {
                    call.resolve([
                        "success": true,
                        "message": "Logged in successfully",
                        "externalId": externalId
                    ])
                } else {
                    call.resolve([
                        "success": false,
                        "message": "Login attempted but verification failed after retries",
                        "externalId": externalId
                    ])
                }
            }
        }
    }
    
    // MARK: - Login with Retry Mechanism
    
    private func performLoginWithRetry(externalId: String, completion: @escaping (Bool) -> Void) {
        loginRetryCount += 1
        
        print("📱 [\(TAG)] 🔄 Login attempt \(loginRetryCount)/\(maxLoginRetries) for: \(externalId.prefix(8))...")
        
        // Log current state before login
        let preLoginSubId = OneSignal.User.pushSubscription.id ?? "nil"
        let preLoginOptedIn = OneSignal.User.pushSubscription.optedIn
        print("📱 [\(TAG)] Pre-login state: subscriptionId=\(preLoginSubId), optedIn=\(preLoginOptedIn)")
        
        // Call OneSignal.login on Main Thread
        OneSignal.login(externalId)
        currentExternalId = externalId
        pendingExternalId = nil
        
        print("📱 [\(TAG)] ✅ OneSignal.login() called for: \(externalId.prefix(8))...")
        
        // Wait 1 second then verify the login was successful
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self = self else {
                completion(false)
                return
            }
            
            // Check current state after login
            let postLoginSubId = OneSignal.User.pushSubscription.id ?? "nil"
            let postLoginOptedIn = OneSignal.User.pushSubscription.optedIn
            let postLoginToken = OneSignal.User.pushSubscription.token
            
            print("📱 [\(self.TAG)] Post-login state (attempt \(self.loginRetryCount)): subscriptionId=\(postLoginSubId), optedIn=\(postLoginOptedIn), hasToken=\(postLoginToken != nil)")
            
            // Consider login successful if we still have subscription after login
            // The external_id linking happens server-side, we can't directly verify it
            if postLoginOptedIn && postLoginToken != nil {
                print("📱 [\(self.TAG)] ✅ Login appears successful (subscription active)")
                
                // Notify JS about successful login
                self.notifyListeners("loginComplete", data: [
                    "externalId": externalId,
                    "subscriptionId": postLoginSubId,
                    "attempt": self.loginRetryCount
                ])
                
                completion(true)
            } else if self.loginRetryCount < self.maxLoginRetries {
                // Retry after another delay
                print("📱 [\(self.TAG)] ⚠️ Subscription not fully ready, retrying in 1s...")
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    self.performLoginWithRetry(externalId: externalId, completion: completion)
                }
            } else {
                print("📱 [\(self.TAG)] ❌ Login verification failed after \(self.maxLoginRetries) attempts")
                completion(false)
            }
        }
    }
    
    // MARK: - Logout
    
    @objc func logout(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] logout() called")
        
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.stopPolling()
            self.loginRetryCount = 0
            
            if !self.isInitialized {
                call.resolve([
                    "success": true,
                    "message": "Not initialized"
                ])
                return
            }
            
            OneSignal.logout()
            self.currentExternalId = nil
            self.pendingExternalId = nil
            
            print("📱 [\(self.TAG)] ✅ Logged out")
            
            call.resolve([
                "success": true,
                "message": "Logged out successfully"
            ])
        }
    }
    
    // MARK: - Request Permission
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        print("📱 [\(TAG)] requestPermission() called")
        
        if !isInitialized {
            call.reject("OneSignal not initialized")
            return
        }
        
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            OneSignal.Notifications.requestPermission({ accepted in
                print("📱 [\(self.TAG)] Permission result: \(accepted)")
                
                if accepted {
                    // OptIn to ensure subscription is created - on Main Thread
                    DispatchQueue.main.async {
                        OneSignal.User.pushSubscription.optIn()
                        print("📱 [\(self.TAG)] ✅ Called optIn() after permission granted")
                        
                        // Start polling to detect when subscription is ready
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
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            let granted = OneSignal.Notifications.permission
            
            call.resolve([
                "granted": granted,
                "initialized": self.isInitialized
            ])
        }
    }
    
    // MARK: - Get Subscription ID
    
    @objc func getSubscriptionId(_ call: CAPPluginCall) {
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            let subscriptionId = self.isInitialized ? OneSignal.User.pushSubscription.id : nil
            
            call.resolve([
                "subscriptionId": subscriptionId as Any,
                "initialized": self.isInitialized
            ])
        }
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
        
        // CRITICAL: Execute on Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            var result: [String: Any] = [
                "initialized": self.isInitialized,
                "currentExternalId": self.currentExternalId as Any,
                "pendingExternalId": self.pendingExternalId as Any,
                "loginRetryCount": self.loginRetryCount
            ]
            
            if self.isInitialized {
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
            
            print("📱 [\(self.TAG)] Full status: \(result)")
            call.resolve(result)
        }
    }
    
    // MARK: - Subscription Polling (SDK 5.x compatible approach)
    
    private func startPollingForSubscription() {
        // Must be called from Main Thread
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.stopPolling()
            self.pollingAttempts = 0
            
            print("📱 [\(self.TAG)] 🔄 Starting subscription polling...")
            
            self.pollingTimer = Timer.scheduledTimer(withTimeInterval: self.pollingInterval, repeats: true) { [weak self] timer in
                guard let self = self else {
                    timer.invalidate()
                    return
                }
                
                self.pollingAttempts += 1
                
                let subscriptionId = OneSignal.User.pushSubscription.id
                let optedIn = OneSignal.User.pushSubscription.optedIn
                let token = OneSignal.User.pushSubscription.token
                
                print("📱 [\(self.TAG)] 🔄 Polling attempt \(self.pollingAttempts)/\(self.maxPollingAttempts) - id: \(subscriptionId ?? "nil"), optedIn: \(optedIn), token: \(token != nil ? "exists" : "nil")")
                
                // Subscription is ready when we have an ID, optedIn is true, AND token exists
                if let subId = subscriptionId, !subId.isEmpty, optedIn, token != nil {
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
        
        // If we have a pending external ID and subscription is fully ready, login now with retry
        if let externalId = pendingExternalId, optedIn, token != nil {
            print("📱 [\(TAG)] 🔧 Subscription ready with pending externalId, logging in with delay...")
            
            // Add small delay before login to ensure OneSignal internal state is ready
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                guard let self = self else { return }
                
                self.loginRetryCount = 0
                self.performLoginWithRetry(externalId: externalId) { success in
                    if success {
                        print("📱 [\(self.TAG)] ✅ Pending login completed successfully")
                    } else {
                        print("📱 [\(self.TAG)] ⚠️ Pending login completed with warnings")
                    }
                }
            }
        }
    }
}
