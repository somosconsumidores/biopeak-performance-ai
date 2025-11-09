import Foundation
import Capacitor
import CoreLocation

@objc(BioPeakLocationTracker)
public class BioPeakLocationTracker: CAPPlugin, CLLocationManagerDelegate {
    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var accumulatedDistance: Double = 0.0
    private var isTracking: Bool = false
    
    // Native feedback control (500m intervals)
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
            self.isTracking = false
            // ⚠️ DO NOT reset sessionStartTime here - we need it for generateCompletionAudio()
            
            print("⏹️ [Native GPS] Stopped tracking - Total distance: \(self.accumulatedDistance)m")
            call.resolve([
                "success": true,
                "message": "Location tracking stopped",
                "finalDistance": self.accumulatedDistance
            ])
        }
    }
    
    @objc func cleanup(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.locationManager = nil
            self.sessionStartTime = nil
            self.sessionId = nil
            self.trainingGoal = nil
            self.accumulatedDistance = 0.0
            self.lastLocation = nil
            self.lastFeedbackSegment = 0
            
            print("🧹 [Native GPS] Cleaned up all session data")
            call.resolve(["success": true])
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
    
    @objc func generateCompletionAudio(_ call: CAPPluginCall) {
        Task {
            do {
                // Calculate final metrics
                guard let sessionStartTime = sessionStartTime else {
                    print("❌ [Native GPS] Session start time not available for completion audio")
                    call.resolve(["success": false, "message": "Session start time not available"])
                    return
                }
                
                let totalDistance = Int(self.accumulatedDistance)
                let timeFromStart = Int(Date().timeIntervalSince1970 - sessionStartTime)
                
                // Calculate average pace
                let currentPace: Double? = {
                    guard totalDistance > 0, timeFromStart > 0 else { return nil }
                    let distanceKm = Double(totalDistance) / 1000.0
                    let timeMinutes = Double(timeFromStart) / 60.0
                    return timeMinutes / distanceKm
                }()
                
                print("🏁 [Native GPS] Generating completion audio:")
                print("   → distance: \(totalDistance)m")
                print("   → time: \(timeFromStart)s")
                if let pace = currentPace {
                    print("   → pace: \(String(format: "%.2f", pace)) min/km")
                }
                
                // Generate completion message
                let message = generateCompletionMessage(meters: totalDistance, timeFromStart: timeFromStart, pace: currentPace)
                print("💬 [Native GPS] Completion message: \(message)")
                
                // Call TTS Edge Function
                print("🌐 [Native GPS] Calling TTS for completion audio...")
                let audioUrl = try await generateTTS(message: message)
                
                // Play completion audio and wait for it to finish
                print("🔊 [Native GPS] Playing completion audio...")
                await playFeedbackAudioAndWait(audioUrl: audioUrl)
                
                print("✅ [Native GPS] Completion audio finished playing")
                call.resolve(["success": true, "message": "Completion audio played"])
                
            } catch {
                print("❌ [Native GPS] Error generating completion audio: \(error)")
                call.resolve(["success": false, "message": error.localizedDescription])
            }
        }
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
                
                // Check 500m milestone
                let currentSegment = Int(accumulatedDistance / 500.0)
                
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
                        let meters = currentSegment * 500
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
            // Calculate time from start
            guard let sessionStartTime = sessionStartTime else {
                print("❌ [Native GPS] Session start time not available")
                return
            }
            let timeFromStart = Int(Date().timeIntervalSince1970 - sessionStartTime)
            
            // Calculate current pace
            let currentPace: Double? = {
                guard meters > 0, timeFromStart > 0 else { return nil }
                let distanceKm = Double(meters) / 1000.0
                let timeMinutes = Double(timeFromStart) / 60.0
                return timeMinutes / distanceKm
            }()
            
            // 1. Generate coaching message
            let message = generateCoachingMessage(meters: meters, timeFromStart: timeFromStart, pace: currentPace)
            print("💬 [Native GPS] Message generated: \(message)")
            if let pace = currentPace {
                print("   → pace: \(String(format: "%.2f", pace)) min/km")
            }
            print("   → time: \(timeFromStart)s")
            
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
    
    // MARK: - Message Formatting Helpers
    
    private func formatDuration(seconds: Int) -> String {
        if seconds < 60 {
            return "\(seconds) segundos"
        }
        
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        
        if remainingSeconds == 0 {
            return minutes == 1 ? "1 minuto" : "\(minutes) minutos"
        } else {
            let minText = minutes == 1 ? "minuto" : "minutos"
            let secText = remainingSeconds == 1 ? "segundo" : "segundos"
            return "\(minutes) \(minText) e \(remainingSeconds) \(secText)"
        }
    }
    
    private func formatPace(minPerKm: Double) -> String {
        let totalSeconds = Int(minPerKm * 60)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        
        if seconds == 0 {
            return "\(minutes) minutos por quilômetro"
        } else {
            let minText = minutes == 1 ? "minuto" : "minutos"
            let secText = seconds == 1 ? "segundo" : "segundos"
            return "\(minutes) \(minText) e \(seconds) \(secText) por quilômetro"
        }
    }
    
    private func generateCoachingMessage(meters: Int, timeFromStart: Int, pace: Double?) -> String {
        let timeText = formatDuration(seconds: timeFromStart)
        
        if let pace = pace, pace > 0 && pace < 100 {
            let paceText = formatPace(minPerKm: pace)
            return "Você completou \(meters) metros em \(timeText). Seu pace atual é \(paceText)."
        } else {
            return "Você completou \(meters) metros em \(timeText). Continue assim!"
        }
    }
    
    private func generateCompletionMessage(meters: Int, timeFromStart: Int, pace: Double?) -> String {
        let distanceKm = Double(meters) / 1000.0
        let distanceText: String
        
        if distanceKm < 1.0 {
            distanceText = "\(meters) metros"
        } else {
            distanceText = String(format: "%.2f quilômetros", distanceKm)
        }
        
        let timeText = formatDuration(seconds: timeFromStart)
        
        var message: String
        if let pace = pace, pace > 0 && pace < 100 {
            let paceText = formatPace(minPerKm: pace)
            message = "Parabéns! Você completou seu treino em \(timeText), percorrendo uma distância de \(distanceText) em um pace de \(paceText). "
        } else {
            message = "Parabéns! Você completou seu treino em \(timeText), percorrendo uma distância de \(distanceText). "
        }
        
        // Add random motivational phrase
        let motivationPhrases = [
            "Excelente desempenho hoje! Continue assim.",
            "Você está evoluindo rápido — orgulhe-se desse treino!",
            "Mais um passo na jornada. Mantenha a constância!",
            "Ótimo trabalho! A cada treino, mais forte.",
            "Treino concluído com sucesso! Descanse bem para o próximo desafio."
        ]
        message += motivationPhrases.randomElement()!
        
        return message
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
    
    private func playFeedbackAudioAndWait(audioUrl: String) async {
        await withCheckedContinuation { continuation in
            let audioId = UUID().uuidString
            
            print("🔊 [Native GPS] Playing audio with ID: \(audioId)")
            print("   → Audio URL length: \(audioUrl.count) chars")
            
            // Register observer for completion
            var observer: NSObjectProtocol?
            observer = NotificationCenter.default.addObserver(
                forName: NSNotification.Name("BioPeakFeedbackFinished"),
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let receivedId = notification.userInfo?["audioId"] as? String,
                      receivedId == audioId else {
                    return
                }
                
                let success = notification.userInfo?["success"] as? Bool ?? false
                print("✅ [Native GPS] Audio playback finished (ID: \(audioId), success: \(success))")
                
                // Remove observer
                if let obs = observer {
                    NotificationCenter.default.removeObserver(obs)
                }
                
                // Resume continuation
                continuation.resume()
            }
            
            // Send notification to play audio
            DispatchQueue.main.async {
                print("📢 [Native GPS] Sending BioPeakPlayFeedback notification with ID: \(audioId)")
                NotificationCenter.default.post(
                    name: NSNotification.Name("BioPeakPlayFeedback"),
                    object: nil,
                    userInfo: [
                        "audioUrl": audioUrl,
                        "audioId": audioId
                    ]
                )
            }
            
            // Add timeout safety (20 seconds)
            DispatchQueue.main.asyncAfter(deadline: .now() + 20.0) {
                if let obs = observer {
                    print("⏱️ [Native GPS] Audio playback timeout (ID: \(audioId)) - continuing anyway")
                    NotificationCenter.default.removeObserver(obs)
                    continuation.resume()
                }
            }
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
        
        // Validate location data availability
        guard let location = lastLocation else {
            print("⚠️ [Native GPS] Snapshot save skipped: No location data available")
            return
        }
        
        // Calculate current pace (min/km)
        let currentPaceMinKm: Double? = {
            guard meters > 0, timeFromStart > 0 else { return nil }
            let distanceKm = Double(meters) / 1000.0
            let timeMinutes = Double(timeFromStart) / 60.0
            return timeMinutes / distanceKm
        }()
        
        // Extract location data
        let currentSpeedMs = location.speed >= 0 ? location.speed : nil
        let latitude = location.coordinate.latitude
        let longitude = location.coordinate.longitude
        let elevationMeters = location.altitude
        
        print("📍 [Native GPS] Snapshot GPS Data:")
        print("   → pace: \(currentPaceMinKm.map { String(format: "%.2f", $0) } ?? "nil") min/km")
        print("   → speed: \(currentSpeedMs.map { String(format: "%.2f", $0) } ?? "nil") m/s")
        print("   → coords: \(String(format: "%.6f", latitude)), \(String(format: "%.6f", longitude))")
        print("   → elevation: \(String(format: "%.1f", elevationMeters))m")
        
        do {
            // Prepare enriched snapshot data
            var snapshotData: [String: Any] = [
                "session_id": sessionId,
                "snapshot_at_distance_meters": meters,
                "snapshot_at_duration_seconds": timeFromStart,
                "latitude": latitude,
                "longitude": longitude,
                "elevation_meters": elevationMeters,
                "source": "native_gps"
            ]
            
            // Add optional fields if available
            if let pace = currentPaceMinKm {
                snapshotData["current_pace_min_km"] = pace
            }
            if let speed = currentSpeedMs {
                snapshotData["current_speed_ms"] = speed
            }
            
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
