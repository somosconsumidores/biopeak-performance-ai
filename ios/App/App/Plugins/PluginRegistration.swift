import Foundation
import Capacitor

@objc public class PluginRegistration: NSObject {
    @objc public static func load() {
        CAPBridge.registerPlugin(BioPeakHealthKit.self)
    }
}