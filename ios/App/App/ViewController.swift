import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BioPeakHealthKit())
        bridge?.registerPluginInstance(BioPeakAudioSession())
        super.capacitorDidLoad()
    }
}