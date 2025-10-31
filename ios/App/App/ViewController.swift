import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BioPeakHealthKit())
        bridge?.registerPluginInstance(BioPeakAudioSession())
        
        // Enable Web Inspector for debugging (iOS 16.4+)
        #if DEBUG
        if #available(iOS 16.4, *) {
            bridge?.webView?.isInspectable = true
        }
        #endif
        
        super.capacitorDidLoad()
    }
}