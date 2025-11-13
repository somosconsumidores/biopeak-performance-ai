import UIKit
import Capacitor
import WebKit

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BioPeakHealthKit())
        bridge?.registerPluginInstance(BioPeakAudioSession())
        bridge?.registerPluginInstance(BioPeakLocationTracker())
        
        super.capacitorDidLoad()
        
        // Enable Web Inspector for debugging (iOS 16.4+)
        // Add a small delay to ensure webView is fully initialized
        #if DEBUG
        if #available(iOS 16.4, *) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.bridge?.webView?.isInspectable = true
                print("✅ Web Inspector enabled - Check Safari > Develop > [Your Device] > BioPeak-ai")
            }
        }
        #endif
    }
    
    // Force portrait orientation at runtime
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
    
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        return .portrait
    }
    
    override var shouldAutorotate: Bool {
        return false
    }
}