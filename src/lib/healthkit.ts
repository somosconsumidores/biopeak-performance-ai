import { Capacitor } from '@capacitor/core';

// HealthKit wrapper for @perfood/capacitor-healthkit
export interface HealthKitPermissionRequest {
  read: string[];
  write: string[];
}

export interface HealthKitPermissionResponse {
  granted: boolean;
}

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

export interface HealthKitQueryResult {
  resultData?: HealthKitSample[];
}

// HealthKit wrapper that handles both real device and development
class HealthKitWrapper {
  private capacitorHealthKit: any = null;

  constructor() {
    this.initializeHealthKit();
  }

  private async initializeHealthKit() {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      try {
        // Dynamic import for @perfood/capacitor-healthkit (graceful failure if not installed)
        const healthKitModule = await eval('import("@perfood/capacitor-healthkit")').catch(() => null);
        if (healthKitModule && healthKitModule.CapacitorHealthkit) {
          this.capacitorHealthKit = healthKitModule.CapacitorHealthkit;
          console.log('[HealthKitWrapper] Real HealthKit initialized');
        } else {
          console.log('[HealthKitWrapper] HealthKit plugin not found, using mock');
          this.capacitorHealthKit = null;
        }
      } catch (error) {
        console.log('[HealthKitWrapper] HealthKit plugin not available, using mock:', error);
        this.capacitorHealthKit = null;
      }
    }
  }

  async requestAuthorization(options: HealthKitPermissionRequest): Promise<HealthKitPermissionResponse> {
    if (this.capacitorHealthKit) {
      try {
        console.log('[HealthKitWrapper] Requesting real HealthKit permissions:', options);
        
        // Map our permission strings to HealthKit types
        const readPermissions = options.read.map(this.mapPermissionToHealthKitType);
        const writePermissions = options.write.map(this.mapPermissionToHealthKitType);

        const result = await this.capacitorHealthKit.requestAuthorization({
          all: [...readPermissions, ...writePermissions],
          read: readPermissions,
          write: writePermissions
        });

        return { granted: !!result };
      } catch (error) {
        console.error('[HealthKitWrapper] Error requesting permissions:', error);
        return { granted: false };
      }
    } else {
      // Mock implementation for development
      console.log('[HealthKitWrapper] Mock: Requesting authorization:', options);
      return { granted: true };
    }
  }

  async queryHKitSampleType(options: HealthKitQueryOptions): Promise<HealthKitQueryResult> {
    if (this.capacitorHealthKit) {
      try {
        console.log('[HealthKitWrapper] Querying real HealthKit samples:', options);
        
        const healthKitType = this.mapSampleNameToHealthKitType(options.sampleName);
        
        const result = await this.capacitorHealthKit.queryHKitSampleType({
          sampleName: healthKitType,
          startDate: new Date(options.startDate),
          endDate: new Date(options.endDate),
          limit: options.limit
        });

        // Transform the result to match our interface
        const transformedResult: HealthKitQueryResult = {
          resultData: result.resultData?.map((sample: any) => ({
            uuid: sample.uuid || sample.id || `hk_${Date.now()}_${Math.random()}`,
            startDate: sample.startDate || sample.startTimestamp,
            endDate: sample.endDate || sample.endTimestamp, 
            value: sample.value?.toString() || '0',
            duration: sample.duration,
            totalDistance: sample.totalDistance,
            totalEnergyBurned: sample.totalEnergyBurned || sample.activeEnergyBurned,
            sourceName: sample.sourceName || sample.sourceRevision?.source?.name,
            device: sample.device || sample.sourceRevision?.source?.name,
            workoutActivityType: sample.workoutActivityType
          }))
        };

        return transformedResult;
      } catch (error) {
        console.error('[HealthKitWrapper] Error querying samples:', error);
        return { resultData: [] };
      }
    } else {
      // Mock implementation for development
      console.log('[HealthKitWrapper] Mock: Querying samples:', options);
      
      if (options.sampleName === 'HKWorkoutTypeIdentifier') {
        return {
          resultData: [
            {
              uuid: `mock_${Date.now()}`,
              startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date(Date.now() - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
              value: '1', // Running
              duration: 1800,
              totalDistance: 5000,
              totalEnergyBurned: 350,
              sourceName: 'Apple Watch',
              device: 'Apple Watch Series 8',
              workoutActivityType: 1
            }
          ]
        };
      } else if (options.sampleName === 'HKQuantityTypeIdentifierHeartRate') {
        // Mock heart rate data
        const heartRateData: HealthKitSample[] = [];
        for (let i = 0; i < 30; i++) {
          heartRateData.push({
            uuid: `hr_${i}`,
            startDate: options.startDate,
            endDate: options.endDate,
            value: (150 + Math.random() * 20).toString() // 150-170 bpm
          });
        }
        return { resultData: heartRateData };
      }
      
      return { resultData: [] };
    }
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