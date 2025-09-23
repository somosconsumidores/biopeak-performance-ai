import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BioPeakHealthKit())
        super.capacitorDidLoad()
    }
}