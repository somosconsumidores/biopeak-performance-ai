import Foundation
import Capacitor
import HealthKit

@objc(BioPeakHealthKit)
public class BioPeakHealthKit: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BioPeakHealthKit"
    public let jsName = "BioPeakHealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ping", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryWorkouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryWorkoutRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryWorkoutSeries", returnType: CAPPluginReturnPromise)
    ]
    private let healthStore = HKHealthStore()
    
    @objc public func ping(_ call: CAPPluginCall) {
        call.resolve(["status": "BioPeakHealthKit plugin is working"])
    }
    
    @objc public func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available")
            return
        }
        
        let readTypes: Set<HKObjectType> = [
            HKWorkoutType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKSeriesType.workoutRoute()
        ]
        
        healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["granted": true])
                } else {
                    call.resolve(["granted": false, "error": error?.localizedDescription ?? "Unknown error"])
                }
            }
        }
    }
    
    @objc public func queryWorkouts(_ call: CAPPluginCall) {
        let startDate = Date(timeIntervalSinceNow: -30 * 24 * 60 * 60) // 30 days ago
        let endDate = Date()
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        
        let query = HKSampleQuery(sampleType: HKWorkoutType.workoutType(),
                                 predicate: predicate,
                                 limit: HKObjectQueryNoLimit,
                                 sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
            
            guard let workouts = samples as? [HKWorkout], error == nil else {
                call.reject("Failed to query workouts: \(error?.localizedDescription ?? "Unknown error")")
                return
            }
            
            var workoutData: [[String: Any]] = []
            
            for workout in workouts {
                let data: [String: Any] = [
                    "uuid": workout.uuid.uuidString,
                    "startDate": ISO8601DateFormatter().string(from: workout.startDate),
                    "endDate": ISO8601DateFormatter().string(from: workout.endDate),
                    "duration": workout.duration,
                    "workoutActivityType": workout.workoutActivityType.rawValue,
                    "totalDistance": workout.totalDistance?.doubleValue(for: .meter()) ?? 0,
                    "totalEnergyBurned": workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
                    "sourceName": workout.source.name,
                    "device": workout.device?.name ?? "Unknown"
                ]
                workoutData.append(data)
            }
            
            DispatchQueue.main.async {
                call.resolve(["workouts": workoutData])
            }
        }
        
        healthStore.execute(query)
    }
    
    @objc public func queryWorkoutRoute(_ call: CAPPluginCall) {
        guard let workoutUUIDString = call.getString("workoutUUID"),
              let workoutUUID = UUID(uuidString: workoutUUIDString) else {
            call.reject("Missing or invalid workoutUUID parameter")
            return
        }
        
        // Step 1: First, fetch the HKWorkout object using its UUID
        let workoutPredicate = HKQuery.predicateForObject(with: workoutUUID)
        let workoutQuery = HKSampleQuery(
            sampleType: HKWorkoutType.workoutType(),
            predicate: workoutPredicate,
            limit: 1,
            sortDescriptors: nil
        ) { [weak self] _, samples, error in
            
            guard let self = self,
                  let workouts = samples as? [HKWorkout],
                  let workout = workouts.first,
                  error == nil else {
                print("[BioPeakHealthKit] Could not find workout with UUID: \(workoutUUIDString)")
                DispatchQueue.main.async {
                    call.resolve(["locations": [], "error": "Workout not found"])
                }
                return
            }
            
            print("[BioPeakHealthKit] Found workout: \(workout.uuid.uuidString)")
            
            // Step 2: Query routes ASSOCIATED with this workout (correct predicate)
            let routePredicate = HKQuery.predicateForObjects(from: workout)
            let routeQuery = HKAnchoredObjectQuery(
                type: HKSeriesType.workoutRoute(),
                predicate: routePredicate,
                anchor: nil,
                limit: HKObjectQueryNoLimit
            ) { _, samples, _, _, error in
                
                guard let routes = samples as? [HKWorkoutRoute], error == nil else {
                    print("[BioPeakHealthKit] No routes found for workout: \(error?.localizedDescription ?? "unknown error")")
                    DispatchQueue.main.async {
                        call.resolve(["locations": []])
                    }
                    return
                }
                
                print("[BioPeakHealthKit] Found \(routes.count) route(s) for workout")
                
                guard let route = routes.first else {
                    DispatchQueue.main.async {
                        call.resolve(["locations": []])
                    }
                    return
                }
                
                // Step 3: Extract location data from the route
                var locations: [[String: Any]] = []
                let locationQuery = HKWorkoutRouteQuery(route: route) { _, locationResults, done, error in
                    
                    if let error = error {
                        print("[BioPeakHealthKit] Route query error: \(error.localizedDescription)")
                    }
                    
                    if let locationResults = locationResults {
                        print("[BioPeakHealthKit] Received batch of \(locationResults.count) locations")
                        for location in locationResults {
                            let locationData: [String: Any] = [
                                "latitude": location.coordinate.latitude,
                                "longitude": location.coordinate.longitude,
                                "altitude": location.altitude,
                                "timestamp": ISO8601DateFormatter().string(from: location.timestamp),
                                "speed": location.speed >= 0 ? location.speed : 0,
                                "course": location.course >= 0 ? location.course : 0,
                                "horizontalAccuracy": location.horizontalAccuracy,
                                "verticalAccuracy": location.verticalAccuracy
                            ]
                            locations.append(locationData)
                        }
                    }
                    
                    if done {
                        print("[BioPeakHealthKit] Route query complete. Total locations: \(locations.count)")
                        DispatchQueue.main.async {
                            call.resolve(["locations": locations])
                        }
                    }
                }
                
                self.healthStore.execute(locationQuery)
            }
            
            self.healthStore.execute(routeQuery)
        }
        
        healthStore.execute(workoutQuery)
    }
    
    @objc public func queryWorkoutSeries(_ call: CAPPluginCall) {
        guard let workoutUUID = call.getString("workoutUUID"),
              let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("Missing parameters")
            return
        }
        
        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: startDateString),
              let endDate = formatter.date(from: endDateString) else {
            call.reject("Invalid date format")
            return
        }
        
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        var seriesData: [String: [[String: Any]]] = [:]
        let group = DispatchGroup()
        
        // Query Heart Rate
        group.enter()
        let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let heartRateQuery = HKSampleQuery(sampleType: heartRateType,
                                          predicate: predicate,
                                          limit: HKObjectQueryNoLimit,
                                          sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
            
            var heartRateData: [[String: Any]] = []
            if let samples = samples as? [HKQuantitySample] {
                for sample in samples {
                    let data: [String: Any] = [
                        "timestamp": ISO8601DateFormatter().string(from: sample.startDate),
                        "value": sample.quantity.doubleValue(for: HKUnit(from: "count/min")),
                        "endTimestamp": ISO8601DateFormatter().string(from: sample.endDate)
                    ]
                    heartRateData.append(data)
                }
            }
            
            seriesData["heartRate"] = heartRateData
            group.leave()
        }
        healthStore.execute(heartRateQuery)
        
        // Query Energy
        group.enter()
        let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        let energyQuery = HKSampleQuery(sampleType: energyType,
                                       predicate: predicate,
                                       limit: HKObjectQueryNoLimit,
                                       sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
            
            var energyData: [[String: Any]] = []
            if let samples = samples as? [HKQuantitySample] {
                for sample in samples {
                    let data: [String: Any] = [
                        "timestamp": ISO8601DateFormatter().string(from: sample.startDate),
                        "value": sample.quantity.doubleValue(for: .kilocalorie()),
                        "endTimestamp": ISO8601DateFormatter().string(from: sample.endDate)
                    ]
                    energyData.append(data)
                }
            }
            
            seriesData["energy"] = energyData
            group.leave()
        }
        healthStore.execute(energyQuery)
        
        group.notify(queue: .main) {
            call.resolve(["series": seriesData])
        }
    }
}