import { useMemo } from 'react';
import { HeartRatePaceData } from './useActivityDetailsChart';

export interface EffortDistribution {
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  pattern: 'negative_split' | 'positive_split' | 'even_pace';
}

interface UseSessionEffortDistributionResult {
  distribution: EffortDistribution | null;
  hasData: boolean;
}

/**
 * Calculates effort distribution across three segments (start, middle, end)
 * of an activity based on heart rate data.
 * 
 * Pattern classification:
 * - negative_split: End effort > Start effort by more than 2% (ideal - accelerates at end)
 * - positive_split: Start effort > End effort by more than 2% (decelerates at end)
 * - even_pace: Difference <= 2% (consistent effort)
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

    const startAvgHR = avgHR(startSegment);
    const middleAvgHR = avgHR(middleSegment);
    const endAvgHR = avgHR(endSegment);

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

    // Determine pattern based on start vs end difference
    const effortDifference = endEffort - startEffort;
    let pattern: 'negative_split' | 'positive_split' | 'even_pace';

    if (effortDifference > 2) {
      pattern = 'negative_split'; // End higher = accelerated/pushed harder at end
    } else if (effortDifference < -2) {
      pattern = 'positive_split'; // Start higher = fatigued at end
    } else {
      pattern = 'even_pace'; // Within ±2% = consistent
    }

    console.log('✅ Effort Distribution calculated:', {
      totalPoints,
      startAvgHR: startAvgHR.toFixed(1),
      middleAvgHR: middleAvgHR.toFixed(1),
      endAvgHR: endAvgHR.toFixed(1),
      maxHR,
      startEffort: startEffort.toFixed(1),
      middleEffort: middleEffort.toFixed(1),
      endEffort: endEffort.toFixed(1),
      pattern
    });

    return {
      startEffort,
      middleEffort,
      endEffort,
      pattern
    };
  }, [chartData]);

  return {
    distribution,
    hasData: distribution !== null
  };
};
