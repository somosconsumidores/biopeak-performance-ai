import { Capacitor } from '@capacitor/core';

// BioPeak Custom HealthKit Plugin Interfaces
export interface HealthKitPermissionRequest {
  read: string[];
  write: string[];
}

export interface HealthKitPermissionResponse {
  granted: boolean;
  error?: string;
}

export interface HealthKitWorkout {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;
  workoutActivityType: number;
  totalDistance: number;
  totalEnergyBurned: number;
  sourceName: string;
  device: string;
}

export interface HealthKitLocation {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  speed: number;
  course: number;
  horizontalAccuracy: number;
  verticalAccuracy: number;
}

export interface HealthKitSeriesData {
  heartRate?: Array<{
    timestamp: string;
    value: number;
    endTimestamp: string;
  }>;
  energy?: Array<{
    timestamp: string;
    value: number;
    endTimestamp: string;
  }>;
}

export interface HealthKitQueryResult {
  workouts?: HealthKitWorkout[];
  locations?: HealthKitLocation[];
  series?: HealthKitSeriesData;
  resultData?: HealthKitSample[]; // Legacy compatibility
}

// Legacy compatibility interfaces
export interface HealthKitQueryOptions {
  sampleName: string;
  startDate: string;
  endDate: string;
  limit: number;
}

export interface HealthKitSample {
  uuid: string;
  startDate: string;
  endDate: string;
  value: string;
  duration?: number;
  totalDistance?: number;
  totalEnergyBurned?: number;
  sourceName?: string;
  device?: string;
  workoutActivityType?: number;
}

// BioPeak Custom HealthKit wrapper
class HealthKitWrapper {
  private customHealthKit: any = null;

  constructor() {
    this.initializeHealthKit();
  }

  private async initializeHealthKit() {
    console.log('[BioPeakHealthKit] Initializing... Platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());
    
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        // Use BioPeak custom HealthKit plugin
        const { BioPeakHealthKit } = Capacitor as any;
        console.log('[BioPeakHealthKit] Capacitor plugins available:', Object.keys(Capacitor));
        console.log('[BioPeakHealthKit] BioPeakHealthKit plugin found:', !!BioPeakHealthKit);
        
        this.customHealthKit = BioPeakHealthKit;
        console.log('[BioPeakHealthKit] Custom HealthKit plugin initialized successfully');
      } catch (error) {
        console.log('[BioPeakHealthKit] Custom plugin not available, using mock:', error);
        this.customHealthKit = null;
      }
    } else {
      console.log('[BioPeakHealthKit] Not iOS or not native platform, using mock');
    }
  }

  async requestAuthorization(options: HealthKitPermissionRequest): Promise<HealthKitPermissionResponse> {
    if (this.customHealthKit) {
      try {
        console.log('[BioPeakHealthKit] NATIVE: Requesting HealthKit permissions:', options);
        console.log('[BioPeakHealthKit] NATIVE: Plugin available:', !!this.customHealthKit);
        
        // Pass the permissions to the native method
        const result = await this.customHealthKit.requestAuthorization({
          read: options.read,
          write: options.write
        });
        
        console.log('[BioPeakHealthKit] NATIVE: Authorization result:', result);
        return { granted: result.granted, error: result.error };
      } catch (error) {
        console.error('[BioPeakHealthKit] Error requesting permissions:', error);
        return { granted: false, error: error.message };
      }
    } else {
      // Mock implementation for development
      console.log('[BioPeakHealthKit] Mock: Requesting authorization:', options);
      return { granted: true };
    }
  }

  async queryWorkouts(): Promise<HealthKitWorkout[]> {
    if (this.customHealthKit) {
      try {
        console.log('[BioPeakHealthKit] Querying workouts');
        const result = await this.customHealthKit.queryWorkouts();
        return result.workouts || [];
      } catch (error) {
        console.error('[BioPeakHealthKit] Error querying workouts:', error);
        return [];
      }
    } else {
      // Mock implementation for development
      console.log('[BioPeakHealthKit] Mock: Querying workouts');
      return [
        {
          uuid: `mock_${Date.now()}`,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
          duration: 1800,
          workoutActivityType: 1, // Running
          totalDistance: 5000,
          totalEnergyBurned: 350,
          sourceName: 'Apple Watch',
          device: 'Apple Watch Series 8'
        }
      ];
    }
  }

  async queryWorkoutRoute(workoutUUID: string): Promise<HealthKitLocation[]> {
    if (this.customHealthKit) {
      try {
        console.log('[BioPeakHealthKit] Querying workout route:', workoutUUID);
        const result = await this.customHealthKit.queryWorkoutRoute({ workoutUUID });
        return result.locations || [];
      } catch (error) {
        console.error('[BioPeakHealthKit] Error querying workout route:', error);
        return [];
      }
    } else {
      // Mock GPS data for development
      console.log('[BioPeakHealthKit] Mock: Querying workout route');
      const mockLocations: HealthKitLocation[] = [];
      for (let i = 0; i < 100; i++) {
        mockLocations.push({
          latitude: -22.9868 + (Math.random() - 0.5) * 0.01,
          longitude: -43.2214 + (Math.random() - 0.5) * 0.01,
          altitude: 50 + Math.random() * 10,
          timestamp: new Date(Date.now() - (100 - i) * 30000).toISOString(),
          speed: 3 + Math.random() * 2,
          course: Math.random() * 360,
          horizontalAccuracy: 5,
          verticalAccuracy: 5
        });
      }
      return mockLocations;
    }
  }

  async queryWorkoutSeries(workoutUUID: string, startDate: string, endDate: string): Promise<HealthKitSeriesData> {
    if (this.customHealthKit) {
      try {
        console.log('[BioPeakHealthKit] Querying workout series:', workoutUUID);
        const result = await this.customHealthKit.queryWorkoutSeries({ 
          workoutUUID, 
          startDate, 
          endDate 
        });
        return result.series || {};
      } catch (error) {
        console.error('[BioPeakHealthKit] Error querying workout series:', error);
        return {};
      }
    } else {
      // Mock series data for development
      console.log('[BioPeakHealthKit] Mock: Querying workout series');
      const mockHeartRate = [];
      const mockEnergy = [];
      
      for (let i = 0; i < 30; i++) {
        const timestamp = new Date(Date.parse(startDate) + i * 60000).toISOString();
        mockHeartRate.push({
          timestamp,
          value: 150 + Math.random() * 20,
          endTimestamp: timestamp
        });
        mockEnergy.push({
          timestamp,
          value: i * 5 + Math.random() * 2,
          endTimestamp: timestamp
        });
      }
      
      return {
        heartRate: mockHeartRate,
        energy: mockEnergy
      };
    }
  }

  // Legacy compatibility method
  async queryHKitSampleType(options: HealthKitQueryOptions): Promise<HealthKitQueryResult> {
    console.log('[BioPeakHealthKit] Legacy method called, redirecting to new API');
    
    if (options.sampleName === 'HKWorkoutTypeIdentifier' || options.sampleName === 'workouts') {
      const workouts = await this.queryWorkouts();
      return {
        resultData: workouts.map(workout => ({
          uuid: workout.uuid,
          startDate: workout.startDate,
          endDate: workout.endDate,
          value: workout.workoutActivityType.toString(),
          duration: workout.duration,
          totalDistance: workout.totalDistance,
          totalEnergyBurned: workout.totalEnergyBurned,
          sourceName: workout.sourceName,
          device: workout.device,
          workoutActivityType: workout.workoutActivityType
        }))
      };
    }
    
    return { resultData: [] };
  }

  private mapPermissionToHealthKitType(permission: string): string {
    const permissionMap: { [key: string]: string } = {
      'steps': 'HKQuantityTypeIdentifierStepCount',
      'distance': 'HKQuantityTypeIdentifierDistanceWalkingRunning', 
      'calories': 'HKQuantityTypeIdentifierActiveEnergyBurned',
      'activity': 'HKWorkoutTypeIdentifier',
      'heart_rate': 'HKQuantityTypeIdentifierHeartRate'
    };
    
    return permissionMap[permission] || permission;
  }

  private mapSampleNameToHealthKitType(sampleName: string): string {
    // If it's already a HealthKit type, return as is
    if (sampleName.startsWith('HK')) {
      return sampleName;
    }
    
    // Map common names to HealthKit types
    const typeMap: { [key: string]: string } = {
      'workouts': 'HKWorkoutTypeIdentifier',
      'heart_rate': 'HKQuantityTypeIdentifierHeartRate',
      'steps': 'HKQuantityTypeIdentifierStepCount',
      'distance': 'HKQuantityTypeIdentifierDistanceWalkingRunning',
      'calories': 'HKQuantityTypeIdentifierActiveEnergyBurned'
    };
    
    return typeMap[sampleName] || sampleName;
  }
}

// Export singleton instance
export const HealthKit = new HealthKitWrapper();