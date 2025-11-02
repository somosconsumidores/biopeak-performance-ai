import Foundation
import Capacitor
import CoreLocation

@objc(BioPeakLocationTracker)
public class BioPeakLocationTracker: CAPPlugin, CLLocationManagerDelegate {
    private var locationManager: CLLocationManager?
    private var lastLocation: CLLocation?
    private var accumulatedDistance: Double = 0.0
    private var isTracking: Bool = false
    
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
        print("🔄 [Native GPS] Distance reset")
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
}
