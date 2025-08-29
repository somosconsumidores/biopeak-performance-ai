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
  level: 'baixo' | 'moderado' | 'alto';
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

      // Fetch variation analysis
      const { data: variationData } = await supabase
        .from('activity_variation_analysis')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12);

      if (variationData) {
        const variationAnalysisData = processVariationAnalysis(variationData);
        setVariationAnalysis(variationAnalysisData);
      }

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
    act.total_distance_meters && act.total_time_minutes
  );
  
  let cardiacEfficiency = 0;
  if (runningWithHRAndDistance.length > 0) {
    cardiacEfficiency = runningWithHRAndDistance.reduce((sum, act) => {
      const totalBeats = act.average_heart_rate * act.total_time_minutes;
      return sum + (act.total_distance_meters / totalBeats);
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

function processVariationAnalysis(data: any[]): VariationAnalysis {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      paceCV: 0,
      hrCV: 0,
      consistency: 'poor',
      weeklyData: []
    };
  }
  
  const avgPaceCV = data.reduce((sum: number, item: any) => sum + (item.pace_cv || 0), 0) / data.length;
  const avgHrCV = data.reduce((sum: number, item: any) => sum + (item.heart_rate_cv || 0), 0) / data.length;
  
  const consistency = avgPaceCV < 0.15 && avgHrCV < 0.15 ? 'good' : 
                    avgPaceCV < 0.25 && avgHrCV < 0.25 ? 'moderate' : 'poor';

  const weeklyData = data.slice(0, 12).map((item, index) => ({
    week: `Sem ${index + 1}`,
    paceCV: item.pace_cv || 0,
    hrCV: item.heart_rate_cv || 0
  }));

  return {
    paceCV: avgPaceCV,
    hrCV: avgHrCV,
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
  const recentActivities = activities.slice(-14); // Last 2 weeks
  const totalVolume = recentActivities.reduce((sum, act) => sum + (act.total_distance_meters || 0), 0);
  const avgIntensity = recentActivities.filter(act => act.average_heart_rate)
    .reduce((sum, act) => sum + act.average_heart_rate, 0) / recentActivities.length;

  let score = 0;
  const factors: string[] = [];

  // Volume factor
  if (totalVolume > 100000) { // > 100km in 2 weeks
    score += 30;
    factors.push('Alto volume de treino');
  }

  // Frequency factor
  if (recentActivities.length > 10) {
    score += 20;
    factors.push('Alta frequência de treinos');
  }

  // Intensity factor
  if (avgIntensity > 160) {
    score += 25;
    factors.push('Alta intensidade média');
  }

  // Recovery factor (simplified)
  const consecutiveDays = Math.min(recentActivities.length, 7);
  if (consecutiveDays > 5) {
    score += 15;
    factors.push('Poucos dias de recuperação');
  }

  const level = score > 60 ? 'alto' : score > 30 ? 'moderado' : 'baixo';

  return { score, level, factors };
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