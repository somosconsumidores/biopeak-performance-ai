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
    private var lastFeedbackAt: TimeInterval = 0
    private var sessionId: String?
    private var trainingGoal: String?
    private var shouldGiveFeedback: Bool = false
    private var sessionStartTime: TimeInterval?
    
    // Supabase credentials
    private var supabaseUrl: String?
    private var supabaseAnonKey: String?
    private var userToken: String?
    
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
            self.sessionStartTime = Date().timeIntervalSince1970
            
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
            self.sessionStartTime = nil
            
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
        self.sessionStartTime = nil
        print("🔄 [Native GPS] Distance reset")
        call.resolve(["success": true])
    }
    
    @objc func configureFeedback(_ call: CAPPluginCall) {
        self.sessionId = call.getString("sessionId")
        self.trainingGoal = call.getString("trainingGoal")
        self.shouldGiveFeedback = call.getBool("enabled") ?? true
        self.supabaseUrl = call.getString("supabaseUrl")
        self.supabaseAnonKey = call.getString("supabaseAnonKey")
        self.userToken = call.getString("userToken")
        self.lastFeedbackSegment = 0
        
        print("✅ [Native GPS] Feedback configured:")
        print("   → sessionId: \(sessionId ?? "nil")")
        print("   → trainingGoal: \(trainingGoal ?? "nil")")
        print("   → enabled: \(shouldGiveFeedback)")
        print("   → supabaseUrl: \(supabaseUrl != nil ? "configured" : "NOT configured")")
        print("   → supabaseAnonKey: \(supabaseAnonKey != nil ? "configured" : "NOT configured")")
        print("   → userToken: \(userToken != nil ? "configured" : "NOT configured")")
        call.resolve(["success": true])
    }
    
    // CLLocationManagerDelegate
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newLocation = locations.last else { return }
        
        // ✅ CORREÇÃO: Filtro mais rigoroso para evitar GPS jumps
        guard newLocation.horizontalAccuracy > 0 && newLocation.horizontalAccuracy <= 20 else {
            print("⚠️ [Native GPS] Low accuracy: \(newLocation.horizontalAccuracy)m")
            return
        }
        
        if let lastLoc = lastLocation {
            let distance = newLocation.distance(from: lastLoc)
            
            // ✅ CORREÇÃO: Filtro endurecido (3m - 20m) com accuracy <= 15m
            if distance >= 3.0 && distance < 20 && newLocation.horizontalAccuracy <= 15 {
                accumulatedDistance += distance
                
                print("📍 [Native GPS] +\(String(format: "%.1f", distance))m → Total: \(String(format: "%.1f", accumulatedDistance))m (accuracy: \(String(format: "%.1f", newLocation.horizontalAccuracy))m)")
                
                // Check 100m milestone
                let currentSegment = Int(accumulatedDistance / 100.0)
                
                print("🔍 [Native GPS] Milestone check:")
                print("   → accumulatedDistance: \(String(format: "%.1f", accumulatedDistance))m")
                print("   → currentSegment: \(currentSegment)")
                print("   → lastFeedbackSegment: \(lastFeedbackSegment)")
                print("   → shouldGiveFeedback: \(shouldGiveFeedback)")
                print("   → Will trigger feedback: \(shouldGiveFeedback && currentSegment > lastFeedbackSegment)")
                
                if shouldGiveFeedback && currentSegment > lastFeedbackSegment {
                    // Throttle: ensure 2s between feedbacks
                    let now = Date().timeIntervalSince1970
                    if now - lastFeedbackAt >= 2.0 {
                        lastFeedbackAt = now
                        lastFeedbackSegment = currentSegment
                        let meters = currentSegment * 100
                        print("🎯 [Native GPS] \(meters)m completed - TRIGGERING FEEDBACK NOW")
                        
                        // Generate and play feedback
                        Task {
                            await generateAndPlayFeedback(meters: meters)
                        }
                    } else {
                        print("⏸️ [Native GPS] Throttle active, skipping duplicate feedback")
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
            
            // 4. Save snapshot to Supabase
            await saveSnapshotToSupabase(meters: meters)
            
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
        guard let supabaseUrl = self.supabaseUrl else {
            print("❌ [Native GPS] TTS Error: Supabase URL not configured")
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase URL not configured"])
        }
        
        guard let supabaseKey = self.supabaseAnonKey else {
            print("❌ [Native GPS] TTS Error: Supabase API key not configured")
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase API key not configured"])
        }
        
        let url = URL(string: "\(supabaseUrl)/functions/v1/text-to-speech")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        
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
    
    // MARK: - Supabase Snapshot Integration
    
    private func saveSnapshotToSupabase(meters: Int) async {
        print("📊 [Native GPS] Saving snapshot to Supabase...")
        print("   → sessionId: \(sessionId ?? "nil")")
        print("   → distance: \(meters)m")
        
        guard let sessionId = sessionId else {
            print("❌ [Native GPS] Snapshot save failed: Session ID not configured")
            return
        }
        
        guard let sessionStartTime = sessionStartTime else {
            print("❌ [Native GPS] Snapshot save failed: Session start time not tracked")
            return
        }
        
        guard let supabaseUrl = self.supabaseUrl,
              let supabaseKey = self.supabaseAnonKey,
              let userToken = self.userToken else {
            print("❌ [Native GPS] Snapshot save failed: Supabase credentials or user token not configured")
            return
        }
        
        // Calculate time from start
        let timeFromStart = Int(Date().timeIntervalSince1970 - sessionStartTime)
        
        print("   → timeFromStart: \(timeFromStart)s")
        
        do {
            // Prepare snapshot data
            let snapshotData: [String: Any] = [
                "session_id": sessionId,
                "snapshot_at_distance_meters": meters,
                "snapshot_at_duration_seconds": timeFromStart,
                "current_pace_min_km": NSNull(), // Not calculated by native GPS
                "source": "native_gps"
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: snapshotData)
            
            // Create request to Supabase REST API
            let url = URL(string: "\(supabaseUrl)/rest/v1/performance_snapshots")!
            var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(userToken)", forHTTPHeaderField: "Authorization")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
            request.httpBody = jsonData
            
            print("📡 [Native GPS] Snapshot Request:")
            print("   → URL: \(url.absoluteString)")
            print("   → Body: \(String(data: jsonData, encoding: .utf8) ?? "unable to decode")")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [Native GPS] Snapshot save failed: Invalid response type")
                return
            }
            
            print("📥 [Native GPS] Snapshot Response:")
            print("   → Status: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                let responseBody = String(data: data, encoding: .utf8) ?? "Unable to decode"
                print("✅ [Native GPS] Snapshot saved successfully:")
                print("   → distance: \(meters)m")
                print("   → time: \(timeFromStart)s")
                print("   → sessionId: \(sessionId)")
                print("   → response: \(responseBody)")
            } else {
                let responseBody = String(data: data, encoding: .utf8) ?? "Unable to decode"
                print("❌ [Native GPS] Snapshot save failed with status \(httpResponse.statusCode)")
                print("   → response: \(responseBody)")
            }
            
        } catch {
            print("❌ [Native GPS] Snapshot save error: \(error)")
            if let nsError = error as NSError? {
                print("   → Domain: \(nsError.domain)")
                print("   → Code: \(nsError.code)")
                print("   → UserInfo: \(nsError.userInfo)")
            }
        }
    }
}
