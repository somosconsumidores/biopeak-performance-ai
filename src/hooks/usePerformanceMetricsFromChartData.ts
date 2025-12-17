// NEW: Hook to calculate performance metrics from activity_chart_data

interface PerformanceMetrics {
  activity_source?: string;
  calories?: number;
  duration?: number;
  efficiency: {
    powerPerBeat: number | null;
    distancePerMinute: number | null;
    comment: string;
  };
  pace: {
    averageSpeedKmh: number | null;
    paceVariationCoefficient: number | null;
    comment: string;
  };
  heartRate: {
    averageHr: number | null;
    maxHr?: number | null;
    relativeIntensity: number | null;
    relativeReserve: number | null;
    comment: string;
  };
  effortDistribution: {
    beginning: number | null;
    middle: number | null;
    end: number | null;
    comment: string;
  };
}

export function formatMetricsFromChartData(chartData: any): PerformanceMetrics {
  if (!chartData?.series_data || !Array.isArray(chartData.series_data)) {
    return getEmptyMetrics();
  }

  const data = chartData.series_data;
  const heartRates = data.map((p: any) => p.heart_rate || p.hr).filter((hr: number) => hr > 0);
  // Filter speeds to realistic values: max 16.7 m/s (60 km/h)
  const speeds = data.map((p: any) => p.speed_ms).filter((s: number) => s > 0 && s <= 16.7);
  
  // Calculate basic stats
  const avgHR = heartRates.length > 0 ? heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length : null;
  const maxHR = heartRates.length > 0 ? Math.max(...heartRates) : null;
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length : null;

  // Calculate effort distribution from heart rate data
  let effortDistribution = {
    beginning: null as number | null,
    middle: null as number | null,
    end: null as number | null,
    comment: 'Sem dados de FC suficientes'
  };

  if (heartRates.length >= 3) {
    const third = Math.floor(heartRates.length / 3);
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    
    const beginning = avg(heartRates.slice(0, third));
    const middle = avg(heartRates.slice(third, 2 * third));
    const end = avg(heartRates.slice(2 * third));
    
    const maxEffort = Math.max(beginning, middle, end);
    const minEffort = Math.min(beginning, middle, end);
    
    let comment = 'Sem dados suficientes';
    if (maxEffort - minEffort <= 10) comment = 'Esforço muito consistente';
    else if (maxEffort - minEffort <= 20) comment = 'Esforço moderadamente consistente';
    else comment = 'Esforço variável';
    
    effortDistribution = {
      beginning,
      middle,
      end,
      comment
    };
  }

  return {
    activity_source: chartData.activity_source,
    duration: chartData.duration_seconds,
    efficiency: {
      powerPerBeat: null,
      distancePerMinute: avgSpeed ? (avgSpeed * 60) / 1000 : null,
      comment: avgSpeed ? `Eficiência: ${((avgSpeed * 60) / 1000).toFixed(2)} km/min` : 'Sem dados'
    },
    pace: {
      averageSpeedKmh: avgSpeed ? avgSpeed * 3.6 : null,
      paceVariationCoefficient: null,
      comment: avgSpeed ? `Velocidade: ${(avgSpeed * 3.6).toFixed(1)} km/h` : 'Sem dados'
    },
    heartRate: {
      averageHr: avgHR ? Math.round(avgHR) : null,
      maxHr: maxHR,
      relativeIntensity: null,
      relativeReserve: null,
      comment: avgHR ? `FC média: ${Math.round(avgHR)} bpm` : 'Sem dados de FC'
    },
    effortDistribution
  };
}

function getEmptyMetrics(): PerformanceMetrics {
  return {
    efficiency: { powerPerBeat: null, distancePerMinute: null, comment: 'Sem dados' },
    pace: { averageSpeedKmh: null, paceVariationCoefficient: null, comment: 'Sem dados' },
    heartRate: { averageHr: null, maxHr: null, relativeIntensity: null, relativeReserve: null, comment: 'Sem dados' },
    effortDistribution: { beginning: null, middle: null, end: null, comment: 'Sem dados' }
  };
}