import Foundation
import Capacitor
import CoreLocation

@objc(BioPeakLocationTracker)
public class BioPeakLocationTracker: CAPPlugin, CLLocationManagerDelegate {
    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var accumulatedDistance: Double = 0.0
    private var isTracking: Bool = false
    
    // Native feedback control
    private var lastFeedbackKm: Int = 0
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
        self.lastFeedbackKm = 0
        print("🔄 [Native GPS] Distance reset")
        call.resolve(["success": true])
    }
    
    @objc func configureFeedback(_ call: CAPPluginCall) {
        self.sessionId = call.getString("sessionId")
        self.trainingGoal = call.getString("trainingGoal")
        self.shouldGiveFeedback = call.getBool("enabled") ?? true
        self.lastFeedbackKm = 0
        
        print("✅ [Native GPS] Feedback configured - Goal: \(trainingGoal ?? "none"), Enabled: \(shouldGiveFeedback)")
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
                
                // Check if completed 1km milestone
                let currentKm = Int(accumulatedDistance / 1000.0)
                
                if shouldGiveFeedback && currentKm > lastFeedbackKm {
                    lastFeedbackKm = currentKm
                    print("🎯 [Native GPS] \(currentKm)km completed - generating feedback")
                    
                    // Generate and play feedback
                    Task {
                        await generateAndPlayFeedback(km: currentKm)
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
    
    private func generateAndPlayFeedback(km: Int) async {
        guard let sessionId = sessionId else {
            print("⚠️ [Native GPS] Session ID not configured for feedback")
            return
        }
        
        do {
            // 1. Generate coaching message
            let message = generateCoachingMessage(km: km)
            
            // 2. Call Edge Function for TTS
            let audioUrl = try await generateTTS(message: message)
            
            // 3. Play audio via BioPeakAudioSession
            await playFeedbackAudio(audioUrl: audioUrl)
            
            print("✅ [Native GPS] Feedback \(km)km played successfully")
            
        } catch {
            print("❌ [Native GPS] Error generating feedback: \(error.localizedDescription)")
        }
    }
    
    private func generateCoachingMessage(km: Int) -> String {
        let pacePerKm = accumulatedDistance > 0 ? (Double(lastFeedbackKm * 1000) / accumulatedDistance) * 5.0 : 5.0
        
        return "\(km) quilômetro completado. Pace médio de \(String(format: "%.1f", pacePerKm)) minutos por quilômetro. Continue assim!"
    }
    
    private func generateTTS(message: String) async throws -> String {
        guard let supabaseUrl = ProcessInfo.processInfo.environment["SUPABASE_URL"] else {
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Supabase URL not configured"])
        }
        
        let url = URL(string: "\(supabaseUrl)/functions/v1/text-to-speech")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["text": message, "voice": "alloy", "speed": 1.0]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "TTS API failed"])
        }
        
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        
        guard let audioContent = json?["audioContent"] as? String else {
            throw NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to get audio content"])
        }
        
        return "data:audio/mpeg;base64,\(audioContent)"
    }
    
    private func playFeedbackAudio(audioUrl: String) async {
        guard let audioSession = self.bridge?.getPlugin("BioPeakAudioSession") as? BioPeakAudioSession else {
            print("❌ [Native GPS] BioPeakAudioSession plugin not available")
            return
        }
        
        // Create a mock CAPPluginCall to pass parameters
        DispatchQueue.main.async {
            let call = MockPluginCall(url: audioUrl)
            audioSession.playAudioFile(call)
            print("🔊 [Native GPS] Playing feedback audio...")
        }
    }
}

// MARK: - Mock Plugin Call for internal communication
private class MockPluginCall: CAPPluginCall {
    let audioUrl: String
    
    init(url: String) {
        self.audioUrl = url
        super.init(callbackId: "internal", options: ["url": url], pluginId: "BioPeakAudioSession", method: "playAudioFile")
    }
    
    override func getString(_ key: String) -> String? {
        return key == "url" ? audioUrl : nil
    }
}
