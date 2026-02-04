import { useMemo } from 'react';
import { HeartRatePaceData } from './useActivityDetailsChart';

export interface EffortDistribution {
  // Esforço baseado em FC
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  
  // Pace por segmento (min/km)
  startPace: number | null;
  middlePace: number | null;
  endPace: number | null;
  
  // Padrões expandidos
  pattern: 'negative_split' | 'positive_split' | 'even_pace' | 'cardiac_drift' | 'economy';
  
  // Flags de diagnóstico
  hasCardiacDrift: boolean;
  paceChange: 'faster' | 'slower' | 'stable';
  hrChange: 'higher' | 'lower' | 'stable';
}

interface UseSessionEffortDistributionResult {
  distribution: EffortDistribution | null;
  hasData: boolean;
}

/**
 * Calculates effort distribution across three segments (start, middle, end)
 * of an activity based on BOTH heart rate AND pace data.
 * 
 * Pattern classification using HR + Pace matrix:
 * - negative_split: HR up + Pace faster (real acceleration)
 * - cardiac_drift: HR up + Pace slower (fatigue - HR rises but slows down)
 * - positive_split: HR down + Pace slower (deceleration)
 * - economy: HR down + Pace faster (rare - improved efficiency)
 * - even_pace: Both stable within ±2%
 */
export const useSessionEffortDistribution = (
  chartData: HeartRatePaceData[]
): UseSessionEffortDistributionResult => {
  const distribution = useMemo(() => {
    // Need at least 9 data points (3 per segment minimum)
    if (!chartData || chartData.length < 9) {
      console.log('⚠️ Effort Distribution: Insufficient data points', chartData?.length || 0);
      return null;
    }

    // Filter valid heart rate data
    const validData = chartData.filter(point => point.heart_rate > 0);
    
    if (validData.length < 9) {
      console.log('⚠️ Effort Distribution: Insufficient valid HR data', validData.length);
      return null;
    }

    // Calculate segment boundaries (by index for even distribution)
    const totalPoints = validData.length;
    const oneThird = Math.floor(totalPoints / 3);
    const twoThirds = Math.floor((totalPoints * 2) / 3);

    // Split data into three segments
    const startSegment = validData.slice(0, oneThird);
    const middleSegment = validData.slice(oneThird, twoThirds);
    const endSegment = validData.slice(twoThirds);

    // Calculate average HR for each segment
    const avgHR = (segment: HeartRatePaceData[]): number => {
      if (segment.length === 0) return 0;
      const sum = segment.reduce((acc, point) => acc + point.heart_rate, 0);
      return sum / segment.length;
    };

    // Calculate average Pace for each segment (filter valid pace values)
    const avgPace = (segment: HeartRatePaceData[]): number | null => {
      const validPacePoints = segment.filter(p => p.pace_min_per_km && p.pace_min_per_km > 0 && p.pace_min_per_km < 30);
      if (validPacePoints.length === 0) return null;
      const sum = validPacePoints.reduce((acc, point) => acc + (point.pace_min_per_km || 0), 0);
      return sum / validPacePoints.length;
    };

    const startAvgHR = avgHR(startSegment);
    const middleAvgHR = avgHR(middleSegment);
    const endAvgHR = avgHR(endSegment);

    const startAvgPace = avgPace(startSegment);
    const middleAvgPace = avgPace(middleSegment);
    const endAvgPace = avgPace(endSegment);

    // Find max HR across all data for normalization
    const maxHR = Math.max(...validData.map(p => p.heart_rate));

    if (maxHR === 0) {
      console.log('⚠️ Effort Distribution: Max HR is 0');
      return null;
    }

    // Normalize to percentage of max HR
    const startEffort = (startAvgHR / maxHR) * 100;
    const middleEffort = (middleAvgHR / maxHR) * 100;
    const endEffort = (endAvgHR / maxHR) * 100;

    // Determine HR change (start vs end)
    const hrDifferencePercent = ((endAvgHR - startAvgHR) / startAvgHR) * 100;
    let hrChange: 'higher' | 'lower' | 'stable';
    if (hrDifferencePercent > 2) {
      hrChange = 'higher';
    } else if (hrDifferencePercent < -2) {
      hrChange = 'lower';
    } else {
      hrChange = 'stable';
    }

    // Determine Pace change (start vs end)
    // Note: lower pace value = faster (e.g., 5:00/km is faster than 6:00/km)
    let paceChange: 'faster' | 'slower' | 'stable' = 'stable';
    const hasPaceData = startAvgPace !== null && endAvgPace !== null;
    
    if (hasPaceData && startAvgPace && endAvgPace) {
      const paceDifferencePercent = ((endAvgPace - startAvgPace) / startAvgPace) * 100;
      if (paceDifferencePercent < -2) {
        paceChange = 'faster'; // End pace is lower = faster
      } else if (paceDifferencePercent > 2) {
        paceChange = 'slower'; // End pace is higher = slower
      } else {
        paceChange = 'stable';
      }
    }

    // Apply decision matrix for pattern classification
    let pattern: 'negative_split' | 'positive_split' | 'even_pace' | 'cardiac_drift' | 'economy';
    let hasCardiacDrift = false;

    if (hasPaceData) {
      // Full matrix with pace data
      if (hrChange === 'higher' && paceChange === 'faster') {
        pattern = 'negative_split'; // Real negative split - faster AND working harder
      } else if (hrChange === 'higher' && paceChange === 'slower') {
        pattern = 'cardiac_drift'; // FATIGUE - HR rose but slowed down
        hasCardiacDrift = true;
      } else if (hrChange === 'lower' && paceChange === 'slower') {
        pattern = 'positive_split'; // Decelerated
      } else if (hrChange === 'lower' && paceChange === 'faster') {
        pattern = 'economy'; // Rare - got faster with less effort
      } else if (hrChange === 'higher' && paceChange === 'stable') {
        pattern = 'cardiac_drift'; // HR rising with stable pace = mild drift
        hasCardiacDrift = true;
      } else if (hrChange === 'stable' && paceChange === 'faster') {
        pattern = 'negative_split'; // Same effort, faster pace = good
      } else if (hrChange === 'stable' && paceChange === 'slower') {
        pattern = 'positive_split'; // Same effort, slower = fatigue
      } else {
        pattern = 'even_pace'; // Both stable
      }
    } else {
      // Fallback to HR-only (when no pace data available)
      if (hrChange === 'higher') {
        pattern = 'negative_split'; // Can't distinguish from cardiac drift without pace
      } else if (hrChange === 'lower') {
        pattern = 'positive_split';
      } else {
        pattern = 'even_pace';
      }
    }

    console.log('✅ Effort Distribution calculated:', {
      totalPoints,
      startAvgHR: startAvgHR.toFixed(1),
      middleAvgHR: middleAvgHR.toFixed(1),
      endAvgHR: endAvgHR.toFixed(1),
      startAvgPace: startAvgPace?.toFixed(2) || 'N/A',
      middleAvgPace: middleAvgPace?.toFixed(2) || 'N/A',
      endAvgPace: endAvgPace?.toFixed(2) || 'N/A',
      hrChange,
      paceChange,
      pattern,
      hasCardiacDrift
    });

    return {
      startEffort,
      middleEffort,
      endEffort,
      startPace: startAvgPace,
      middlePace: middleAvgPace,
      endPace: endAvgPace,
      pattern,
      hasCardiacDrift,
      paceChange,
      hrChange
    };
  }, [chartData]);

  return {
    distribution,
    hasData: distribution !== null
  };
};
