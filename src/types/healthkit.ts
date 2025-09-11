// Re-export types from the HealthKit wrapper
export type {
  HealthKitPermissionRequest as HealthRequestAuthorization,
  HealthKitPermissionResponse as HealthPermissionResponse,
  HealthKitQueryOptions as HealthQueryOptions,
  HealthKitSample as HealthSample,
  HealthKitQueryResult as HealthQueryResult
} from '../lib/healthkit';

// Re-export the HealthKit instance as Health for backward compatibility
export { HealthKit as Health } from '../lib/healthkit';