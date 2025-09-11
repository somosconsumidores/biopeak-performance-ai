// Type definitions for @capacitor-community/health
export interface HealthRequestAuthorization {
  read: string[];
  write: string[];
}

export interface HealthPermissionResponse {
  granted: boolean;
}

export interface HealthQueryOptions {
  sampleName: string;
  startDate: string;
  endDate: string;
  limit: number;
}

export interface HealthSample {
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

export interface HealthQueryResult {
  resultData?: HealthSample[];
}

// Mock Health API for when the package isn't available
export const Health = {
  async requestAuthorization(options: HealthRequestAuthorization): Promise<HealthPermissionResponse> {
    console.log('[MockHealth] Requesting authorization:', options);
    // In development, always grant permissions
    return { granted: true };
  },

  async queryHKitSampleType(options: HealthQueryOptions): Promise<HealthQueryResult> {
    console.log('[MockHealth] Querying samples:', options);
    // Return mock data for development
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
      const heartRateData: HealthSample[] = [];
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
};