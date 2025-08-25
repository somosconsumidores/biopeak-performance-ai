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
  const speeds = data.map((p: any) => p.speed_ms).filter((s: number) => s > 0);
  
  // Calculate basic stats
  const avgHR = heartRates.length > 0 ? heartRates.reduce((a: number, b: number) => a + b, 0) / heartRates.length : null;
  const maxHR = heartRates.length > 0 ? Math.max(...heartRates) : null;
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length : null;

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
    effortDistribution: {
      beginning: null,
      middle: null,
      end: null,
      comment: 'Calculado a partir de dados unificados'
    }
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