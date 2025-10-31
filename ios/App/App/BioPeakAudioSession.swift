import Foundation
import Capacitor
import AVFoundation

@objc(BioPeakAudioSession)
public class BioPeakAudioSession: CAPPlugin {
    var silentPlayer: AVAudioPlayer?
    
    @objc func startAudioSession(_ call: CAPPluginCall) {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            
            // Configure audio session for playback in background
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
            
            // Start silent audio to keep session active
            startSilentAudioInternal()
            
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
}
