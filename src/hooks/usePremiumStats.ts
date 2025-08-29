import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyStats {
  averageDistance: number;
  weeklyDistanceTrend: 'up' | 'down' | 'stable';
  distanceChange: number;
  volumeData: Array<{
    week: string;
    distance: number;
    workouts: number;
  }>;
}

interface PaceStats {
  averagePace: number;
  paceTrend: 'up' | 'down' | 'stable';
  paceChange: number;
  trendData: Array<{
    date: string;
    pace: number;
    isBest: boolean;
  }>;
}

interface HeartRateStats {
  averageHR: number;
  cardiacEfficiency: number;
  hrTrend: 'up' | 'down' | 'stable';
  zonesData: Array<{
    week: string;
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  }>;
}

interface VariationAnalysis {
  paceCV: number;
  hrCV: number;
  consistency: 'good' | 'moderate' | 'poor';
  weeklyData: Array<{
    week: string;
    paceCV: number;
    hrCV: number;
  }>;
}

interface EffortDistribution {
  startEffort: number;
  middleEffort: number;
  endEffort: number;
  pattern: 'negative_split' | 'positive_split' | 'even_pace';
}

interface OvertrainingRisk {
  score: number;
  level: 'baixo' | 'medio' | 'alto';
  factors: string[];
}

interface Achievement {
  title: string;
  description: string;
  icon: string;
  achievedAt: Date;
}

interface GPSData {
  coordinates: Array<[number, number]>;
  intensity: number[];
  bounds: [[number, number], [number, number]];
}

export const usePremiumStats = () => {
  const { user } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [paceStats, setPaceStats] = useState<PaceStats | null>(null);
  const [heartRateStats, setHeartRateStats] = useState<HeartRateStats | null>(null);
  const [variationAnalysis, setVariationAnalysis] = useState<VariationAnalysis | null>(null);
  const [effortDistribution, setEffortDistribution] = useState<EffortDistribution | null>(null);
  const [overtrainingRisk, setOvertrainingRisk] = useState<OvertrainingRisk | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPremiumStats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch recent activities (last 12 weeks)
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      const { data: activities, error: activitiesError } = await supabase
        .from('all_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('activity_date', twelveWeeksAgo.toISOString().split('T')[0])
        .order('activity_date', { ascending: true });

      if (activitiesError) throw activitiesError;

      // Process weekly stats
      const weeklyData = processWeeklyStats(activities || []);
      setWeeklyStats(weeklyData);

      // Process pace stats
      const paceData = processPaceStats(activities || []);
      setPaceStats(paceData);

      // Process heart rate stats
      const hrData = processHeartRateStats(activities || []);
      setHeartRateStats(hrData);

      // Calculate variation analysis from activities
      const variationAnalysisData = processVariationAnalysis(activities || []);
      setVariationAnalysis(variationAnalysisData);

      // Process effort distribution
      const effortData = processEffortDistribution(activities || []);
      setEffortDistribution(effortData);

      // Calculate overtraining risk
      const overtrainingData = calculateOvertrainingRisk(activities || []);
      setOvertrainingRisk(overtrainingData);

      // Fetch achievements
      const { data: achievementsData } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement_definitions(title, description, icon)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(10);

      if (achievementsData) {
        const processedAchievements = achievementsData.map(item => ({
          title: item.achievement_definitions?.title || 'Conquista',
          description: item.achievement_definitions?.description || '',
          icon: item.achievement_definitions?.icon || 'trophy',
          achievedAt: new Date(item.earned_at)
        }));
        setAchievements(processedAchievements);
      }

      // Fetch GPS data for heatmap
      const { data: coordinatesData } = await supabase
        .from('activity_coordinates')
        .select('coordinates, starting_latitude, starting_longitude')
        .eq('user_id', user.id)
        .not('coordinates', 'is', null)
        .limit(50);

      if (coordinatesData) {
        const gpsHeatmapData = processGPSData(coordinatesData);
        setGpsData(gpsHeatmapData);
      }

    } catch (err: any) {
      console.error('Error fetching premium stats:', err);
      setError(err.message || 'Erro ao carregar estatísticas premium');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshInsights = useCallback(async () => {
    // Trigger AI insights regeneration
    if (!user) return;
    
    try {
      const { error } = await supabase.functions.invoke('generate-premium-insights', {
        body: { user_id: user.id }
      });
      
      if (error) throw error;
      
      // Refresh stats after generating new insights
      await fetchPremiumStats();
    } catch (err: any) {
      console.error('Error refreshing insights:', err);
    }
  }, [user, fetchPremiumStats]);

  useEffect(() => {
    fetchPremiumStats();

    // Set up real-time subscriptions for automatic updates
    const activitiesChannel = supabase
      .channel('premium-stats-activities')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'all_activities',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          console.log('Activity change detected, refreshing premium stats...');
          fetchPremiumStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_coordinates',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          console.log('GPS coordinates change detected, refreshing premium stats...');
          fetchPremiumStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          console.log('Achievement change detected, refreshing premium stats...');
          fetchPremiumStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitiesChannel);
    };
  }, [fetchPremiumStats, user?.id]);

  return {
    weeklyStats,
    paceStats,
    heartRateStats,
    variationAnalysis,
    effortDistribution,
    overtrainingRisk,
    achievements,
    gpsData,
    loading,
    error,
    refreshInsights
  };
};

// Helper functions
function processWeeklyStats(activities: any[]): WeeklyStats {
  // Group activities by week
  const weeklyGroups = activities.reduce((acc, activity) => {
    const date = new Date(activity.activity_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = [];
    }
    acc[weekKey].push(activity);
    return acc;
  }, {} as Record<string, any[]>);

  const volumeData = Object.entries(weeklyGroups).map(([week, activities]: [string, any[]]) => {
    const totalDistance = activities.reduce((sum, act) => 
      sum + (act.total_distance_meters || 0), 0) / 1000; // Convert to km
    
    return {
      week: new Date(week).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      distance: totalDistance,
      workouts: activities.length
    };
  }).slice(-12); // Last 12 weeks

  const averageDistance = volumeData.reduce((sum, week) => sum + week.distance, 0) / volumeData.length;
  
  // Calculate trend
  const recentWeeks = volumeData.slice(-4);
  const earlierWeeks = volumeData.slice(-8, -4);
  const recentAvg = recentWeeks.reduce((sum, week) => sum + week.distance, 0) / recentWeeks.length;
  const earlierAvg = earlierWeeks.reduce((sum, week) => sum + week.distance, 0) / earlierWeeks.length;
  
  const distanceChange = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  const weeklyDistanceTrend = distanceChange > 5 ? 'up' : distanceChange < -5 ? 'down' : 'stable';

  return {
    averageDistance: Math.round(averageDistance * 10) / 10,
    weeklyDistanceTrend,
    distanceChange: Math.abs(distanceChange),
    volumeData
  };
}

function processPaceStats(activities: any[]): PaceStats {
  const runningActivities = activities.filter(act => 
    act.activity_type === 'RUNNING' && act.pace_min_per_km
  );

  if (runningActivities.length === 0) {
    return {
      averagePace: 0,
      paceTrend: 'stable',
      paceChange: 0,
      trendData: []
    };
  }

  const averagePace = runningActivities.reduce((sum, act) => sum + act.pace_min_per_km, 0) / runningActivities.length;
  
  // Calculate trend data
  const trendData = runningActivities.slice(-30).map(act => {
    const bestPace = Math.min(...runningActivities.map(a => a.pace_min_per_km));
    // Parse date string directly without timezone conversion to avoid date shift
    const dateParts = act.activity_date.split('-');
    const activityDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    
    return {
      date: activityDate.toLocaleDateString('pt-BR'),
      pace: act.pace_min_per_km,
      isBest: act.pace_min_per_km === bestPace
    };
  });

  // Calculate pace trend
  const recentPace = runningActivities.slice(-10).reduce((sum, act) => sum + act.pace_min_per_km, 0) / 10;
  const earlierPace = runningActivities.slice(-20, -10).reduce((sum, act) => sum + act.pace_min_per_km, 0) / 10;
  const paceChange = ((earlierPace - recentPace) / earlierPace) * 100; // Positive means improvement
  const paceTrend = paceChange > 2 ? 'up' : paceChange < -2 ? 'down' : 'stable';

  return {
    averagePace: Math.round(averagePace * 100) / 100,
    paceTrend,
    paceChange: Math.abs(paceChange),
    trendData
  };
}

function processHeartRateStats(activities: any[]): HeartRateStats {
  const activitiesWithHR = activities.filter(act => act.average_heart_rate);
  
  if (activitiesWithHR.length === 0) {
    return {
      averageHR: 0,
      cardiacEfficiency: 0,
      hrTrend: 'stable',
      zonesData: []
    };
  }

  const averageHR = activitiesWithHR.reduce((sum, act) => sum + act.average_heart_rate, 0) / activitiesWithHR.length;
  
  // Calculate cardiac efficiency (meters per heartbeat)
  const runningWithHRAndDistance = activitiesWithHR.filter(act => 
    act.total_distance_meters && act.total_time_minutes && act.average_heart_rate > 0
  );
  
  let cardiacEfficiency = 0;
  if (runningWithHRAndDistance.length > 0) {
    cardiacEfficiency = runningWithHRAndDistance.reduce((sum, act) => {
      // total_time_minutes * average_heart_rate (bpm) = total heartbeats
      const totalBeats = act.average_heart_rate * act.total_time_minutes;
      // meters per heartbeat
      const efficiency = act.total_distance_meters / totalBeats;
      return sum + efficiency;
    }, 0) / runningWithHRAndDistance.length;
  }

  // Mock zones data (would need real heart rate zones calculation)
  const zonesData = Array.from({ length: 12 }, (_, i) => ({
    week: `Sem ${i + 1}`,
    zone1: 20 + Math.random() * 10,
    zone2: 30 + Math.random() * 15,
    zone3: 25 + Math.random() * 10,
    zone4: 15 + Math.random() * 8,
    zone5: 5 + Math.random() * 5
  }));

  return {
    averageHR: Math.round(averageHR),
    cardiacEfficiency: Math.round(cardiacEfficiency * 100) / 100,
    hrTrend: 'stable',
    zonesData
  };
}

function processVariationAnalysis(activities: any[]): VariationAnalysis {
  if (!Array.isArray(activities) || activities.length === 0) {
    return {
      paceCV: 0,
      hrCV: 0,
      consistency: 'poor',
      weeklyData: []
    };
  }
  
  // Filter running activities with valid data from last 12 weeks
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  
  const runningActivities = activities.filter(act => {
    const activityDate = new Date(act.activity_date);
    const isRunning = act.activity_type && act.activity_type.toLowerCase().includes('run');
    const hasValidPace = act.pace_min_per_km && act.pace_min_per_km > 0;
    const isRecent = activityDate >= twelveWeeksAgo;
    
    return isRunning && hasValidPace && isRecent;
  });

  const hrActivities = activities.filter(act => {
    const activityDate = new Date(act.activity_date);
    const hasValidHR = act.average_heart_rate && act.average_heart_rate > 0;
    const isRecent = activityDate >= twelveWeeksAgo;
    
    return hasValidHR && isRecent;
  });

  // Calculate Pace CV (Coefficient of Variation)
  let paceCV = 0;
  if (runningActivities.length >= 3) {
    const paces = runningActivities.map(act => act.pace_min_per_km);
    const avgPace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
    const variance = paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length;
    const stdDev = Math.sqrt(variance);
    paceCV = stdDev / avgPace; // CV as decimal
  }

  // Calculate Heart Rate CV
  let hrCV = 0;
  if (hrActivities.length >= 3) {
    const heartRates = hrActivities.map(act => act.average_heart_rate);
    const avgHR = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
    const variance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - avgHR, 2), 0) / heartRates.length;
    const stdDev = Math.sqrt(variance);
    hrCV = stdDev / avgHR; // CV as decimal
  }

  // Determine consistency level
  const consistency = paceCV < 0.10 && hrCV < 0.08 ? 'good' : 
                     paceCV < 0.15 && hrCV < 0.12 ? 'moderate' : 'poor';

  // Generate weekly data for the last 12 weeks
  const weeklyData = [];
  for (let i = 0; i < 12; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - ((i - 1) * 7));

    const weekActivities = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      return actDate >= weekStart && actDate < weekEnd;
    });

    const weekRunning = weekActivities.filter(act => 
      act.activity_type && act.activity_type.toLowerCase().includes('run') && 
      act.pace_min_per_km && act.pace_min_per_km > 0
    );

    const weekHR = weekActivities.filter(act => 
      act.average_heart_rate && act.average_heart_rate > 0
    );

    // Calculate weekly CVs
    let weekPaceCV = 0;
    let weekHrCV = 0;

    if (weekRunning.length >= 2) {
      const weekPaces = weekRunning.map(act => act.pace_min_per_km);
      const weekAvgPace = weekPaces.reduce((sum, pace) => sum + pace, 0) / weekPaces.length;
      const weekPaceVar = weekPaces.reduce((sum, pace) => sum + Math.pow(pace - weekAvgPace, 2), 0) / weekPaces.length;
      weekPaceCV = Math.sqrt(weekPaceVar) / weekAvgPace;
    }

    if (weekHR.length >= 2) {
      const weekHRs = weekHR.map(act => act.average_heart_rate);
      const weekAvgHR = weekHRs.reduce((sum, hr) => sum + hr, 0) / weekHRs.length;
      const weekHRVar = weekHRs.reduce((sum, hr) => sum + Math.pow(hr - weekAvgHR, 2), 0) / weekHRs.length;
      weekHrCV = Math.sqrt(weekHRVar) / weekAvgHR;
    }

    weeklyData.unshift({
      week: `Sem ${12 - i}`,
      paceCV: weekPaceCV,
      hrCV: weekHrCV
    });
  }

  return {
    paceCV,
    hrCV,
    consistency,
    weeklyData
  };
}

function processEffortDistribution(activities: any[]): EffortDistribution {
  // Mock calculation - would need detailed heart rate data
  const startEffort = 75 + Math.random() * 15;
  const middleEffort = 85 + Math.random() * 10;
  const endEffort = 80 + Math.random() * 15;
  
  let pattern: 'negative_split' | 'positive_split' | 'even_pace' = 'even_pace';
  if (endEffort > startEffort + 5) pattern = 'negative_split';
  else if (startEffort > endEffort + 5) pattern = 'positive_split';

  return {
    startEffort,
    middleEffort,
    endEffort,
    pattern
  };
}

function calculateOvertrainingRisk(activities: any[]): OvertrainingRisk {
  if (activities.length === 0) {
    return {
      score: 0,
      level: 'baixo',
      factors: ['Dados insuficientes para análise']
    };
  }

  // Filtros de tempo
  const now = new Date();
  const last7Days = activities.filter(act => {
    const actDate = new Date(act.activity_date);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return actDate >= sevenDaysAgo;
  });

  const last14Days = activities.filter(act => {
    const actDate = new Date(act.activity_date);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    return actDate >= fourteenDaysAgo;
  });

  const last30Days = activities.filter(act => {
    const actDate = new Date(act.activity_date);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return actDate >= thirtyDaysAgo;
  });

  let score = 0;
  const factors: string[] = [];

  // === Fator 1: Carga de Treino (35% do score) ===
  const calculateTrainingLoad = (activities: any[]) => {
    return activities.reduce((total, act) => {
      const duration = ((act.total_time_minutes || 0) * 60) / 3600; // em horas
      const calories = act.active_kilocalories || 0;
      const avgHR = act.average_heart_rate || 0;
      const maxHR = act.max_heart_rate || 220; // estimativa se não houver dado
      
      // Intensidade baseada na FC (mais realista)
      let intensityFactor = 1;
      if (avgHR > 0 && maxHR > 0) {
        const hrReserve = (avgHR / maxHR);
        if (hrReserve >= 0.75) intensityFactor = 2.5; // Zona 4-5
        else if (hrReserve >= 0.65) intensityFactor = 2.0; // Zona 3
        else if (hrReserve >= 0.55) intensityFactor = 1.5; // Zona 2
      }
      
      // Fator de atividade
      const activityType = (act.activity_type || '').toLowerCase();
      let activityFactor = 1;
      if (activityType.includes('run')) activityFactor = 1.2;
      else if (activityType.includes('bike') || activityType.includes('cycling')) activityFactor = 1.0;
      else if (activityType.includes('swim')) activityFactor = 1.3;
      
      return total + (duration * intensityFactor * activityFactor * (calories / 100));
    }, 0);
  };

  const currentWeekLoad = calculateTrainingLoad(last7Days);
  const previousWeekLoad = calculateTrainingLoad(last14Days.slice(7));
  const avgMonthlyLoad = calculateTrainingLoad(last30Days) / 4.3; // média semanal do mês

  // Análise de carga
  if (currentWeekLoad > avgMonthlyLoad * 1.5) {
    score += 35;
    factors.push(`Carga de treino muito alta (${currentWeekLoad.toFixed(1)} vs média ${avgMonthlyLoad.toFixed(1)})`);
  } else if (currentWeekLoad > avgMonthlyLoad * 1.2) {
    score += 20;
    factors.push('Carga de treino elevada');
  }

  // === Fator 2: Frequência e Recuperação (25% do score) ===
  const weeklyFrequency = last7Days.length;
  const consecutiveDays = getConsecutiveTrainingDays(last7Days);
  
  if (weeklyFrequency > 6) {
    score += 15;
    factors.push('Frequência muito alta (>6 treinos/semana)');
  } else if (weeklyFrequency > 5) {
    score += 8;
    factors.push('Frequência alta');
  }

  if (consecutiveDays > 5) {
    score += 10;
    factors.push(`${consecutiveDays} dias consecutivos sem descanso`);
  } else if (consecutiveDays > 3) {
    score += 5;
    factors.push('Poucos dias de recuperação');
  }

  // === Fator 3: Intensidade Acumulada (20% do score) ===
  const highIntensityCount = last7Days.filter(act => {
    const avgHR = act.average_heart_rate || 0;
    const maxHR = act.max_heart_rate || 220;
    const calories = act.active_kilocalories || 0;
    const duration = ((act.total_time_minutes || 0) * 60) / 3600;
    
    // Critério mais realista: FC > 75% ou alta queima calórica
    const highHR = avgHR > 0 && maxHR > 0 && (avgHR / maxHR) > 0.75;
    const highCalorieRate = duration > 0 && (calories / duration) > 400; // cal/hora
    
    return highHR || highCalorieRate;
  }).length;

  const intensityRatio = last7Days.length > 0 ? (highIntensityCount / last7Days.length) : 0;
  if (intensityRatio > 0.6) {
    score += 20;
    factors.push(`${Math.round(intensityRatio * 100)}% treinos alta intensidade`);
  } else if (intensityRatio > 0.4) {
    score += 10;
    factors.push('Muitos treinos intensos');
  }

  // === Fator 4: Tendência de Volume (20% do score) ===
  if (previousWeekLoad > 0) {
    const loadIncrease = (currentWeekLoad - previousWeekLoad) / previousWeekLoad;
    if (loadIncrease > 0.3) {
      score += 20;
      factors.push(`Aumento súbito de ${Math.round(loadIncrease * 100)}% na carga`);
    } else if (loadIncrease > 0.15) {
      score += 10;
      factors.push('Crescimento rápido no volume');
    }
  }

  // Determinar nível de risco
  const level = score >= 50 ? 'alto' : score >= 25 ? 'medio' : 'baixo';

  return {
    score: Math.min(100, score),
    level,
    factors: factors.length > 0 ? factors : ['Carga de treino equilibrada']
  };
}

// Função auxiliar para calcular dias consecutivos
function getConsecutiveTrainingDays(activities: any[]): number {
  if (activities.length === 0) return 0;
  
  // Filtrar atividades insignificantes (menos de 5 minutos ou 10 calorias)
  const significantActivities = activities.filter(act => {
    const duration = ((act.total_time_minutes || 0) * 60) || 0;
    const calories = act.active_kilocalories || 0;
    return duration >= 300 || calories >= 10; // 5 minutos ou 10+ calorias
  });
  
  if (significantActivities.length === 0) return 0;

  // Agrupar por dia
  const dayGroups: { [key: string]: any[] } = {};
  significantActivities.forEach(act => {
    const dayKey = act.activity_date;
    if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
    dayGroups[dayKey].push(act);
  });

  const trainingDays = Object.keys(dayGroups).sort().reverse();
  
  let consecutive = 0;
  let currentDate = new Date();
  
  for (const day of trainingDays) {
    const actDate = new Date(day);
    const daysDiff = Math.floor((currentDate.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === consecutive) {
      consecutive++;
    } else if (daysDiff > consecutive) {
      break;
    }
  }
  
  return consecutive;
}

function processGPSData(coordinatesData: any[]): GPSData {
  const allCoordinates: Array<[number, number]> = [];
  const intensity: number[] = [];

  coordinatesData.forEach(item => {
    if (item.coordinates && Array.isArray(item.coordinates)) {
      item.coordinates.forEach((coord: any) => {
        // Coordinates are stored as arrays [lat, lng]
        if (Array.isArray(coord) && coord.length === 2 && 
            typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          allCoordinates.push([coord[0], coord[1]]);
          intensity.push(Math.random()); // Mock intensity
        }
      });
    }
  });

  if (allCoordinates.length === 0) {
    return {
      coordinates: [],
      intensity: [],
      bounds: [[-23.5505, -46.6333], [-23.5505, -46.6333]] // Default São Paulo bounds
    };
  }

  const lats = allCoordinates.map(coord => coord[0]);
  const lngs = allCoordinates.map(coord => coord[1]);
  
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];

  return {
    coordinates: allCoordinates,
    intensity,
    bounds
  };
}