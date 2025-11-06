import Foundation
import Capacitor
import AVFoundation

@objc(BioPeakAudioSession)
public class BioPeakAudioSession: CAPPlugin, AVAudioPlayerDelegate {
    var silentPlayer: AVAudioPlayer?
    var feedbackPlayer: AVAudioPlayer?
    var currentAudioId: String?
    
    @objc func startAudioSession(_ call: CAPPluginCall) {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            // Configure audio session for playback in background
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
            
            // Add observer for audio interruptions
            NotificationCenter.default.addObserver(
                forName: AVAudioSession.interruptionNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let self = self,
                      let userInfo = notification.userInfo,
                      let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
                      let type = AVAudioSession.InterruptionType(rawValue: typeValue)
                else { return }
                
                if type == .ended {
                    print("🔄 [BioPeakAudioSession] Interruption ended, resuming silent audio")
                    self.startSilentAudioInternal()
                } else if type == .began {
                    print("⏸️ [BioPeakAudioSession] Interruption began (call/Siri)")
                }
            }
            
            // Start silent audio to keep session active
            startSilentAudioInternal()
            
            // Register observer for native feedback
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleNativeFeedback),
                name: NSNotification.Name("BioPeakPlayFeedback"),
                object: nil
            )
            
            call.resolve([
                "success": true,
                "message": "Audio session started successfully"
            ])
            
            print("✅ AVAudioSession configured for background playback")
        } catch {
            call.reject("Failed to start audio session: \(error.localizedDescription)")
            print("❌ AVAudioSession error: \(error)")
        }
    }
    
    @objc func stopAudioSession(_ call: CAPPluginCall) {
        do {
            // Stop silent audio first
            stopSilentAudioInternal()
            
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
            
            call.resolve([
                "success": true,
                "message": "Audio session stopped successfully"
            ])
            
            print("✅ AVAudioSession deactivated")
        } catch {
            call.reject("Failed to stop audio session: \(error.localizedDescription)")
            print("❌ AVAudioSession deactivation error: \(error)")
        }
    }
    
    @objc func setAudioCategory(_ call: CAPPluginCall) {
        guard let category = call.getString("category") else {
            call.reject("Category parameter is required")
            return
        }
        
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            var audioCategory: AVAudioSession.Category = .playback
            switch category {
            case "playback":
                audioCategory = .playback
            case "record":
                audioCategory = .record
            case "playAndRecord":
                audioCategory = .playAndRecord
            default:
                audioCategory = .playback
            }
            
            let optionsArray = call.getArray("options", String.self)
            var options: AVAudioSession.CategoryOptions = []
            
            if let optionsArray = optionsArray {
                for option in optionsArray {
                    switch option {
                    case "mixWithOthers":
                        options.insert(.mixWithOthers)
                    case "duckOthers":
                        options.insert(.duckOthers)
                    case "allowBluetooth":
                        options.insert(.allowBluetooth)
                    default:
                        break
                    }
                }
            }
            
            try audioSession.setCategory(audioCategory, mode: .default, options: options)
            try audioSession.setActive(true)
            
            call.resolve([
                "success": true,
                "category": category,
                "options": optionsArray ?? []
            ])
            
            print("✅ AVAudioSession category set to: \(category)")
        } catch {
            call.reject("Failed to set audio category: \(error.localizedDescription)")
            print("❌ AVAudioSession category error: \(error)")
        }
    }
    
    @objc func startSilentAudio(_ call: CAPPluginCall) {
        startSilentAudioInternal()
        call.resolve([
            "success": true,
            "message": "Silent audio started successfully"
        ])
    }
    
    @objc func stopSilentAudio(_ call: CAPPluginCall) {
        stopSilentAudioInternal()
        call.resolve([
            "success": true,
            "message": "Silent audio stopped successfully"
        ])
    }
    
    @objc func playAudioFile(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url") else {
            call.reject("URL required")
            return
        }
        
        print("🎵 [BioPeakAudioSession] playAudioFile chamado com URL tipo:", urlString.hasPrefix("data:") ? "Data URL" : "HTTP URL")
        
        // AVAudioSession já está ativa via startSilentAudio() - apenas reproduzir o áudio
        
        // Check if it's a Data URL
        if urlString.hasPrefix("data:audio/mpeg;base64,") || urlString.hasPrefix("data:audio/mp3;base64,") {
            // Extract base64 string
            let base64String = urlString.components(separatedBy: ",").last ?? ""
            
            guard let audioData = Data(base64Encoded: base64String, options: .ignoreUnknownCharacters) else {
                print("❌ [BioPeakAudioSession] Falha ao decodificar base64")
                call.reject("Failed to decode base64 audio data")
                return
            }
            
            print("✅ [BioPeakAudioSession] Base64 decodificado, tamanho:", audioData.count, "bytes")
            
            do {
                // Stop any existing feedback audio
                feedbackPlayer?.stop()
                feedbackPlayer = nil
                
                // Create audio player directly from Data
                feedbackPlayer = try AVAudioPlayer(data: audioData)
                guard let player = feedbackPlayer else {
                    call.reject("Failed to create audio player")
                    return
                }
                
                player.volume = 0.8
                player.prepareToPlay()
                
                let playSuccess = player.play()
                
                if playSuccess {
                    let duration = player.duration
                    print("✅ [BioPeakAudioSession] Áudio Data URL reproduzindo, duração:", duration, "segundos")
                    
                    call.resolve([
                        "success": true,
                        "message": "Audio playing from Data URL",
                        "duration": duration
                    ])
                } else {
                    print("❌ [BioPeakAudioSession] player.play() returned false")
                    call.reject("Failed to start playback")
                }
            } catch {
                print("❌ [BioPeakAudioSession] Erro ao criar AVAudioPlayer:", error.localizedDescription)
                call.reject("Failed to play audio: \(error.localizedDescription)")
            }
            
            return
        }
        
        // Handle HTTP/HTTPS URLs (existing behavior)
        guard let url = URL(string: urlString) else {
            print("❌ [BioPeakAudioSession] URL inválida:", urlString)
            call.reject("Invalid URL")
            return
        }
        
        print("🌐 [BioPeakAudioSession] Baixando áudio de URL HTTP...")
        
        // Download audio file
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self else { return }
            
            guard let data = data, error == nil else {
                print("❌ [BioPeakAudioSession] Erro no download:", error?.localizedDescription ?? "unknown")
                call.reject("Failed to download audio")
                return
            }
            
            print("✅ [BioPeakAudioSession] Áudio baixado, tamanho:", data.count, "bytes")
            
            do {
                // Stop any existing feedback audio
                self.feedbackPlayer?.stop()
                self.feedbackPlayer = nil
                
                // Create and play audio
                self.feedbackPlayer = try AVAudioPlayer(data: data)
                guard let player = self.feedbackPlayer else {
                    call.reject("Failed to create audio player")
                    return
                }
                
                player.volume = 0.8
                player.prepareToPlay()
                
                let playSuccess = player.play()
                
                if playSuccess {
                    let duration = player.duration
                    print("✅ [BioPeakAudioSession] Áudio HTTP reproduzindo, duração:", duration, "segundos")
                    
                    call.resolve([
                        "success": true,
                        "message": "Audio playing from HTTP URL",
                        "duration": duration
                    ])
                } else {
                    print("❌ [BioPeakAudioSession] player.play() returned false")
                    call.reject("Failed to start playback")
                }
            } catch {
                print("❌ [BioPeakAudioSession] Erro ao reproduzir:", error.localizedDescription)
                call.reject("Failed to play audio: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func stopFeedbackAudio(_ call: CAPPluginCall) {
        if let player = feedbackPlayer {
            player.stop()
            feedbackPlayer = nil
            print("🔇 Feedback audio stopped")
        }
        call.resolve(["success": true])
    }
    
    private func startSilentAudioInternal() {
        guard let url = Bundle.main.url(forResource: "silence", withExtension: "mp3") else {
            print("⚠️ Silent audio file not found - background audio may not work optimally")
            return
        }
        
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
            
            silentPlayer = try AVAudioPlayer(contentsOf: url)
            silentPlayer?.numberOfLoops = -1  // Loop infinitely
            silentPlayer?.volume = 0.01       // Almost inaudible
            silentPlayer?.play()
            
            print("🔊 Silent audio started (keeps background active)")
        } catch {
            print("❌ Failed to start silent audio: \(error.localizedDescription)")
        }
    }
    
    private func stopSilentAudioInternal() {
        if let player = silentPlayer {
            player.stop()
            silentPlayer = nil
            print("🔇 Silent audio stopped")
        }
    }
    
    @objc private func handleNativeFeedback(_ notification: Notification) {
        guard let audioUrl = notification.userInfo?["audioUrl"] as? String else {
            print("⚠️ [BioPeakAudioSession] URL de áudio não fornecida na notificação")
            return
        }
        
        let audioId = notification.userInfo?["audioId"] as? String
        
        print("🔔 [BioPeakAudioSession] Recebeu notificação para tocar feedback nativo")
        playAudioFromDataURL(audioUrl, audioId: audioId)
    }
    
    private func playAudioFromDataURL(_ urlString: String, audioId: String?) {
        guard urlString.hasPrefix("data:audio/mpeg;base64,") || urlString.hasPrefix("data:audio/mp3;base64,") else {
            print("❌ [BioPeakAudioSession] URL inválida: esperado Data URL")
            return
        }
        
        let base64String = urlString.components(separatedBy: ",").last ?? ""
        
        guard let audioData = Data(base64Encoded: base64String, options: .ignoreUnknownCharacters) else {
            print("❌ [BioPeakAudioSession] Falha ao decodificar base64")
            return
        }
        
        print("✅ [BioPeakAudioSession] Base64 decodificado, tamanho:", audioData.count, "bytes")
        
        do {
            feedbackPlayer?.stop()
            feedbackPlayer = nil
            
            feedbackPlayer = try AVAudioPlayer(data: audioData)
            guard let player = feedbackPlayer else {
                print("❌ [BioPeakAudioSession] Falha ao criar player")
                return
            }
            
            // Store the audio ID for this playback
            currentAudioId = audioId
            
            // Set delegate to get notified when playback finishes
            player.delegate = self
            player.volume = 0.8
            player.prepareToPlay()
            
            let playSuccess = player.play()
            
            if playSuccess {
                print("✅ [BioPeakAudioSession] Feedback nativo tocando, duração:", player.duration, "segundos")
                if let id = audioId {
                    print("   → audioId: \(id)")
                }
            } else {
                print("❌ [BioPeakAudioSession] player.play() retornou false")
            }
        } catch {
            print("❌ [BioPeakAudioSession] Erro ao reproduzir:", error.localizedDescription)
        }
    }
    
    // MARK: - AVAudioPlayerDelegate
    
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        print("🎵 [BioPeakAudioSession] Audio playback finished successfully: \(flag)")
        
        // Post notification that audio finished
        if let audioId = currentAudioId {
            print("📢 [BioPeakAudioSession] Posting BioPeakFeedbackFinished with ID: \(audioId)")
            NotificationCenter.default.post(
                name: NSNotification.Name("BioPeakFeedbackFinished"),
                object: nil,
                userInfo: ["audioId": audioId, "success": flag]
            )
        }
        
        currentAudioId = nil
    }
    
    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        print("❌ [BioPeakAudioSession] Audio decode error: \(error?.localizedDescription ?? "unknown")")
        
        // Post notification that audio failed
        if let audioId = currentAudioId {
            NotificationCenter.default.post(
                name: NSNotification.Name("BioPeakFeedbackFinished"),
                object: nil,
                userInfo: ["audioId": audioId, "success": false, "error": error?.localizedDescription ?? "decode error"]
            )
        }
        
        currentAudioId = nil
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self, name: AVAudioSession.interruptionNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: NSNotification.Name("BioPeakPlayFeedback"), object: nil)
    }
}
