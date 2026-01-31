import { Capacitor, registerPlugin } from '@capacitor/core';

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

export interface HealthKitSleepSession {
  date: string;
  inBedSeconds: number;
  totalSleepSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSeconds: number;
}

export interface HealthKitQueryResult {
  workouts?: HealthKitWorkout[];
  locations?: HealthKitLocation[];
  series?: HealthKitSeriesData;
  sleepSessions?: HealthKitSleepSession[];
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

// BioPeak Custom HealthKit Plugin Interfaces
interface BioPeakHealthKitPlugin {
  ping(): Promise<{ status: string }>;
  requestAuthorization(options?: any): Promise<HealthKitPermissionResponse>;
  queryWorkouts(): Promise<{ workouts: HealthKitWorkout[] }>;
  queryWorkoutRoute(options: { workoutUUID: string }): Promise<{ locations: HealthKitLocation[] }>;
  queryWorkoutSeries(options: { workoutUUID: string; startDate: string; endDate: string }): Promise<{ series: HealthKitSeriesData }>;
  querySleepData(): Promise<{ sleepSessions: HealthKitSleepSession[] }>;
}

const BioPeakHealthKit = registerPlugin<BioPeakHealthKitPlugin>('BioPeakHealthKit');

// BioPeak Custom HealthKit wrapper
class HealthKitWrapper {
  private plugin: BioPeakHealthKitPlugin;

  constructor() {
    this.plugin = BioPeakHealthKit;
    console.log('[BioPeakHealthKit] JS Wrapper v3.0 loaded with CAPBridgedPlugin');
  }

  async ping(): Promise<{ status: string }> {
    try {
      return await this.plugin.ping();
    } catch (error) {
      console.error('[BioPeakHealthKit] Ping failed:', error);
      return { status: 'BioPeakHealthKit plugin ping failed: ' + (error as Error).message };
    }
  }

  async requestAuthorization(options: HealthKitPermissionRequest): Promise<HealthKitPermissionResponse> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        const mappedRead = (options.read || []).map((p) => this.mapPermissionToHealthKitType(p));
        const mappedWrite = (options.write || []).map((p) => this.mapPermissionToHealthKitType(p));
        console.log('[BioPeakHealthKit] NATIVE: Requesting HealthKit permissions:', {
          original: options,
          mappedRead,
          mappedWrite,
        });
        
        // Use the new CAPBridgedPlugin
        const result = await this.plugin.requestAuthorization({
          read: mappedRead,
          write: mappedWrite,
        });
        
        console.log('[BioPeakHealthKit] NATIVE: Authorization result:', result);
        return { granted: result.granted, error: result.error };
      } catch (error: any) {
        console.error('[BioPeakHealthKit] Error requesting permissions:', error);
        return { granted: false, error: error?.message || String(error) };
      }
    } else {
      // Mock implementation for web development
      console.log('[BioPeakHealthKit] Mock: Requesting authorization:', options);
      return { granted: true };
    }
  }

  async queryWorkouts(): Promise<HealthKitWorkout[]> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        console.log('[BioPeakHealthKit] Querying workouts');
        const result = await this.plugin.queryWorkouts();
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
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        console.log('[BioPeakHealthKit] Querying workout route for:', workoutUUID);
        const result = await this.plugin.queryWorkoutRoute({ workoutUUID });
        console.log('[BioPeakHealthKit] Route query result:', result);
        console.log('[BioPeakHealthKit] Found', result.locations?.length || 0, 'GPS points');
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
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        console.log('[BioPeakHealthKit] Querying workout series:', workoutUUID);
        const result = await this.plugin.queryWorkoutSeries({ 
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

  async querySleepData(): Promise<HealthKitSleepSession[]> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        console.log('[BioPeakHealthKit] Querying sleep data');
        const result = await this.plugin.querySleepData();
        console.log('[BioPeakHealthKit] Found', result.sleepSessions?.length || 0, 'sleep sessions');
        return result.sleepSessions || [];
      } catch (error) {
        console.error('[BioPeakHealthKit] Error querying sleep data:', error);
        return [];
      }
    } else {
      // Mock sleep data for development
      console.log('[BioPeakHealthKit] Mock: Querying sleep data');
      const today = new Date();
      const mockSessions: HealthKitSleepSession[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const totalSleep = 25200 + Math.floor(Math.random() * 7200); // 7-9 hours
        const deepSleep = Math.floor(totalSleep * (0.15 + Math.random() * 0.1)); // 15-25%
        const remSleep = Math.floor(totalSleep * (0.18 + Math.random() * 0.1)); // 18-28%
        const lightSleep = totalSleep - deepSleep - remSleep;
        
        mockSessions.push({
          date: dateStr,
          inBedSeconds: totalSleep + Math.floor(Math.random() * 1800),
          totalSleepSeconds: totalSleep,
          deepSleepSeconds: deepSleep,
          lightSleepSeconds: lightSleep,
          remSleepSeconds: remSleep,
          awakeSeconds: Math.floor(Math.random() * 600)
        });
      }
      
      return mockSessions;
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
      'heart_rate': 'HKQuantityTypeIdentifierHeartRate',
      'sleep': 'HKCategoryTypeIdentifierSleepAnalysis'
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