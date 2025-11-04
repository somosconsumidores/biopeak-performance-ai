import Foundation
import Capacitor
import CoreLocation

@objc(BioPeakLocationTracker)
public class BioPeakLocationTracker: CAPPlugin, CLLocationManagerDelegate {
    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var accumulatedDistance: Double = 0.0
    private var isTracking: Bool = false
    
    // Native feedback control (100m intervals for testing)
    private var lastFeedbackSegment: Int = 0
    private var sessionId: String?
    private var trainingGoal: String?
    private var shouldGiveFeedback: Bool = false
    
    @objc func startLocationTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            if self.isTracking {
                call.resolve(["success": true, "message": "Already tracking"])
                return
            }
            
            self.locationManager = CLLocationManager()
            self.locationManager?.delegate = self
            self.locationManager?.allowsBackgroundLocationUpdates = true
            self.locationManager?.showsBackgroundLocationIndicator = true
            self.locationManager?.desiredAccuracy = kCLLocationAccuracyBest
            self.locationManager?.distanceFilter = 5
            self.locationManager?.pausesLocationUpdatesAutomatically = false
            
            // Reset accumulated distance
            self.accumulatedDistance = 0.0
            self.lastLocation = nil
            self.isTracking = true
            
            self.locationManager?.startUpdatingLocation()
            
            print("✅ [Native GPS] Started tracking")
            call.resolve(["success": true, "message": "Location tracking started"])
        }
    }
    
    @objc func stopLocationTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.locationManager?.stopUpdatingLocation()
            self.locationManager = nil
            self.isTracking = false
            
            print("⏹️ [Native GPS] Stopped tracking - Total distance: \(self.accumulatedDistance)m")
            call.resolve([
                "success": true,
                "message": "Location tracking stopped",
                "finalDistance": self.accumulatedDistance
            ])
        }
    }
    
    @objc func getAccumulatedDistance(_ call: CAPPluginCall) {
        call.resolve(["distance": self.accumulatedDistance])
    }
    
    @objc func resetDistance(_ call: CAPPluginCall) {
        self.accumulatedDistance = 0.0
        self.lastLocation = nil
        self.lastFeedbackSegment = 0
        print("🔄 [Native GPS] Distance reset")
        call.resolve(["success": true])
    }
    
    @objc func configureFeedback(_ call: CAPPluginCall) {
        self.sessionId = call.getString("sessionId")
        self.trainingGoal = call.getString("trainingGoal")
        self.shouldGiveFeedback = call.getBool("enabled") ?? true
        self.lastFeedbackSegment = 0
        
        print("✅ [Native GPS] Feedback configured:")
        print("   → sessionId: \(sessionId ?? "nil")")
        print("   → trainingGoal: \(trainingGoal ?? "nil")")
        print("   → enabled: \(shouldGiveFeedback)")
        call.resolve(["success": true])
    }
    
    // CLLocationManagerDelegate
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newLocation = locations.last else { return }
        
        // Validate accuracy
        guard newLocation.horizontalAccuracy > 0 && newLocation.horizontalAccuracy < 50 else {
            print("⚠️ [Native GPS] Low accuracy: \(newLocation.horizontalAccuracy)m")
            return
        }
        
        if let lastLoc = lastLocation {
            let distance = newLocation.distance(from: lastLoc)
            
            // Filter unrealistic movements (>3m and <100m to avoid GPS jumps)
            if distance > 3 && distance < 100 {
                accumulatedDistance += distance
                
                print("📍 [Native GPS] +\(String(format: "%.1f", distance))m → Total: \(String(format: "%.1f", accumulatedDistance))m (accuracy: \(String(format: "%.1f", newLocation.horizontalAccuracy))m)")
                
                // Check if completed 100m milestone (for testing)
                let currentSegment = Int(accumulatedDistance / 100.0)
                
                print("🔍 [Native GPS] Milestone check:")
                print("   → accumulatedDistance: \(String(format: "%.1f", accumulatedDistance))m")
                print("   → currentSegment: \(currentSegment)")
                print("   → lastFeedbackSegment: \(lastFeedbackSegment)")
                print("   → shouldGiveFeedback: \(shouldGiveFeedback)")
                print("   → Will trigger feedback: \(shouldGiveFeedback && currentSegment > lastFeedbackSegment)")
                
                if shouldGiveFeedback && currentSegment > lastFeedbackSegment {
                    lastFeedbackSegment = currentSegment
                    let meters = currentSegment * 100
                    print("🎯 [Native GPS] \(meters)m completed - TRIGGERING FEEDBACK NOW")
                    
                    // Generate and play feedback
                    Task {
                        await generateAndPlayFeedback(meters: meters)
                    }
                }
                
                // Send event to JavaScript
                notifyListeners("locationUpdate", data: [
                    "latitude": newLocation.coordinate.latitude,
                    "longitude": newLocation.coordinate.longitude,
                    "accuracy": newLocation.horizontalAccuracy,
                    "altitude": newLocation.altitude,
                    "speed": newLocation.speed,
                    "heading": newLocation.course,
                    "distance": distance,
                    "totalDistance": accumulatedDistance,
                    "timestamp": newLocation.timestamp.timeIntervalSince1970 * 1000
                ])
            } else if distance >= 100 {
                print("⚠️ [Native GPS] GPS jump detected: \(String(format: "%.1f", distance))m - ignored")
            }
        } else {
            print("📍 [Native GPS] First location acquired")
        }
        
        lastLocation = newLocation
    }
    
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [Native GPS] Error: \(error.localizedDescription)")
        
        notifyListeners("locationError", data: [
            "error": error.localizedDescription
        ])
    }
    
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        print("🔐 [Native GPS] Authorization changed: \(status.rawValue)")
    }
    
    // MARK: - Native Feedback Generation
    
    private func generateAndPlayFeedback(meters: Int) async {
        print("🎯 [Native GPS] generateAndPlayFeedback called for \(meters)m")
        print("   → sessionId: \(sessionId ?? "nil")")
        
        guard let sessionId = sessionId else {
            print("❌ [Native GPS] STOPPED: Session ID not configured")
            return
        }
        
        do {
            // 1. Generate coaching message
            let message = generateCoachingMessage(meters: meters)
            print("💬 [Native GPS] Message generated: \(message)")
            
            // 2. Call Edge Function for TTS
            print("🌐 [Native GPS] Calling TTS Edge Function...")
            let audioUrl = try await generateTTS(message: message)
            print("✅ [Native GPS] TTS returned audio URL (length: \(audioUrl.count) chars)")
            
            // 3. Play audio via BioPeakAudioSession
            print("🔊 [Native GPS] Attempting to play audio...")
            await playFeedbackAudio(audioUrl: audioUrl)
            
            print("✅ [Native GPS] Feedback \(meters)m completed successfully")
            
        } catch {
            print("❌ [Native GPS] Feedback error: \(error)")
            if let nsError = error as NSError? {
                print("   → Domain: \(nsError.domain)")
                print("   → Code: \(nsError.code)")
                print("   → UserInfo: \(nsError.userInfo)")
            }
        }
    }
    
    private func generateCoachingMessage(meters: Int) -> String {
        return "\(meters) metros completados. Continue assim!"
    }
    
    private func generateTTS(message: String) async throws -> String {
        guard let supabaseUrl = ProcessInfo.processInfo.environment["SUPABASE_URL"] else {
            print("❌ [Native GPS] TTS Error: Supabase URL not configured")
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase URL not configured"])
        }
        
        let url = URL(string: "\(supabaseUrl)/functions/v1/text-to-speech")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["text": message, "voice": "alloy", "speed": 1.0]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📡 [Native GPS] TTS Request:")
        print("   → URL: \(url.absoluteString)")
        print("   → Body: \(body)")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            print("❌ [Native GPS] TTS Error: Invalid response type")
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }
        
        print("📥 [Native GPS] TTS Response:")
        print("   → Status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let responseBody = String(data: data, encoding: .utf8) ?? "Unable to decode"
            print("❌ [Native GPS] TTS Error Response Body: \(responseBody)")
            throw NSError(domain: "TTS", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "TTS API failed with status \(httpResponse.statusCode)"])
        }
        
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        
        print("   → Has audioContent: \(json?["audioContent"] != nil)")
        
        guard let audioContent = json?["audioContent"] as? String else {
            print("❌ [Native GPS] TTS Error: audioContent missing in response")
            print("   → Response keys: \(json?.keys.joined(separator: ", ") ?? "none")")
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to get audio content"])
        }
        
        print("✅ [Native GPS] TTS audio content received (length: \(audioContent.count) chars)")
        return "data:audio/mpeg;base64,\(audioContent)"
    }
    
    private func playFeedbackAudio(audioUrl: String) async {
        print("🔊 [Native GPS] Preparing to send notification...")
        print("   → Audio URL length: \(audioUrl.count) chars")
        print("   → Audio URL prefix: \(String(audioUrl.prefix(50)))")
        
        // Send notification to BioPeakAudioSession to play the audio
        DispatchQueue.main.async {
            print("📢 [Native GPS] Sending BioPeakPlayFeedback notification to audio session")
            NotificationCenter.default.post(
                name: NSNotification.Name("BioPeakPlayFeedback"),
                object: nil,
                userInfo: ["audioUrl": audioUrl]
            )
            print("✅ [Native GPS] Notification posted to NotificationCenter")
        }
    }
}
