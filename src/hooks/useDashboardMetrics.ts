import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFitnessScore } from '@/hooks/useFitnessScore';
import { useOvertrainingRisk, OvertrainingRisk } from '@/hooks/useOvertrainingRisk';

// Cache configuration
const DASHBOARD_CACHE_KEY = 'dashboard_metrics_cache';
const DASHBOARD_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milliseconds

interface DashboardMetrics {
  vo2Max: {
    current: number | null;
    change: number;
    trend: 'up' | 'down';
    source?: string;
  };
  heartRate: {
    average: number;
    change: number;
    trend: 'up' | 'down';
  };
  trainingZone: {
    currentZone: string;
    percentage: number;
    trend: 'up' | 'down';
  };
  recovery: {
    level: number;
    change: number;
    trend: 'up' | 'down';
  };
  bioPeakFitness: {
    score: number | null;
    change: number;
    trend: 'up' | 'down' | 'stable';
    label: string;
    components?: {
      capacity: number;
      consistency: number;
      recovery: number;
    };
  };
}

interface ActivityDistribution {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface WeeklyData {
  day: string;
  training: number;
  recovery: number;
}

interface Alert {
  type: 'warning' | 'success' | 'info';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

interface RecentActivity {
  date: string;
  type: string;
  duration: string;
  distance: string;
  avgPace: string;
  performance: 'Excelente' | 'Bom' | 'Regular';
  color: string;
}

interface PeakPerformance {
  current: number;
  prediction: string;
  potential: number;
}

interface SleepAnalytics {
  sleepScore: number | null;
  lastSleepDate: string | null;
  hoursSlept: string | null;
  qualityComment: string;
  deepSleepPercentage: number;
  lightSleepPercentage: number;
  remSleepPercentage: number;
  totalSleepMinutes: number;
}

interface CachedDashboardData {
  metrics: DashboardMetrics | null;
  activityDistribution: ActivityDistribution[];
  alerts: Alert[];
  recentActivities: RecentActivity[];
  peakPerformance: PeakPerformance | null;
  sleepAnalytics: SleepAnalytics | null;
  activities: any[];
  timestamp: number;
  userId: string;
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activityDistribution, setActivityDistribution] = useState<ActivityDistribution[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [peakPerformance, setPeakPerformance] = useState<PeakPerformance | null>(null);
  const [overtrainingRisk, setOvertrainingRisk] = useState<OvertrainingRisk | null>(null);
  const [sleepAnalytics, setSleepAnalytics] = useState<SleepAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const { user } = useAuth();
  const { currentScore, getScoreTrend, getScoreLabel } = useFitnessScore();
  
  // Use unified overtraining risk calculation
  const calculatedOvertrainingRisk = useOvertrainingRisk(activities);

  // Cache functions
  const getCachedData = useCallback((): CachedDashboardData | null => {
    try {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!cached) return null;
      
      const data: CachedDashboardData = JSON.parse(cached);
      const isExpired = Date.now() - data.timestamp > DASHBOARD_CACHE_DURATION;
      const isSameUser = data.userId === user?.id;
      
      if (isExpired || !isSameUser) {
        localStorage.removeItem(DASHBOARD_CACHE_KEY);
        return null;
      }
      
      return data;
    } catch {
      localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
  }, [user?.id]);

  const setCachedData = useCallback((data: Omit<CachedDashboardData, 'timestamp' | 'userId'>) => {
    if (!user) return;
    
    const cacheData: CachedDashboardData = {
      ...data,
      timestamp: Date.now(),
      userId: user.id,
    };
    
    try {
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cacheData));
      console.log('✅ Dashboard data cached successfully');
    } catch (e) {
      console.error('Failed to cache dashboard data:', e);
    }
  }, [user]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(DASHBOARD_CACHE_KEY);
    console.log('🗑️ Dashboard cache cleared');
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchDashboardData(false);
  }, [user]);

  const fetchDashboardData = async (forceRefresh = false) => {
    if (!user) return;

    try {
      // 1. Tentar usar cache primeiro (se não for refresh forçado)
      if (!forceRefresh) {
        const cached = getCachedData();
        if (cached) {
          const expiresIn = Math.round((DASHBOARD_CACHE_DURATION - (Date.now() - cached.timestamp)) / 1000);
          console.log('📦 Using cached dashboard data (expires in', expiresIn, 'seconds)');
          
          setMetrics(cached.metrics);
          setActivityDistribution(cached.activityDistribution);
          setAlerts(cached.alerts);
          setRecentActivities(cached.recentActivities);
          setPeakPerformance(cached.peakPerformance);
          setSleepAnalytics(cached.sleepAnalytics);
          setActivities(cached.activities);
          setLoading(false);
          return;
        }
      }

      // 2. Buscar dados novos do Supabase
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching fresh dashboard data from Supabase...');

      // Usar a tabela unificada all_activities para máxima performance
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sinceDateStr = sixtyDaysAgo.toISOString().split('T')[0];

      // Otimizar query: selecionar apenas campos necessários
      const [allActivitiesRes, garminVo2MaxRes] = await Promise.all([
        supabase
          .from('all_activities')
          .select(`
            id,
            activity_date,
            activity_type,
            total_distance_meters,
            total_time_minutes,
            average_heart_rate,
            max_heart_rate,
            pace_min_per_km,
            active_kilocalories,
            total_elevation_gain_in_meters,
            total_elevation_loss_in_meters,
            activity_source
          `)
          .eq('user_id', user.id)
          .gte('activity_date', sinceDateStr)
          .order('activity_date', { ascending: false })
          .limit(100),
        fetchGarminVo2Max(user.id, sinceDateStr)
      ]);

      if (allActivitiesRes.error) throw allActivitiesRes.error;

      const fetchedActivities = allActivitiesRes.data ?? [];
      const garminVo2MaxData = garminVo2MaxRes || [];

      if (!fetchedActivities || fetchedActivities.length === 0) {
        setMetrics(null);
        setActivityDistribution([]);
        setAlerts([]);
        setRecentActivities([]);
        setPeakPerformance(null);
        setOvertrainingRisk(null);
        setLoading(false);
        return;
      }

      // Set activities for overtraining risk calculation
      setActivities(fetchedActivities);
      
      // Calcular métricas principais
      const calculatedMetrics = calculateMetrics(fetchedActivities, garminVo2MaxData);
      setMetrics(calculatedMetrics);

      // Calcular distribuição de atividades
      const distribution = calculateActivityDistribution(fetchedActivities);
      setActivityDistribution(distribution);

      // Gerar alertas inteligentes
      const intelligentAlerts = generateAlerts(fetchedActivities);
      setAlerts(intelligentAlerts);

      // Buscar atividades recentes
      const recentActs = formatRecentActivities(fetchedActivities.slice(0, 5));
      setRecentActivities(recentActs);

      // Calcular pico de performance
      const peak = calculatePeakPerformance(fetchedActivities);
      setPeakPerformance(peak);

      // 3. Salvar no cache (sem sleep data ainda)
      setCachedData({
        metrics: calculatedMetrics,
        activityDistribution: distribution,
        alerts: intelligentAlerts,
        recentActivities: recentActs,
        peakPerformance: peak,
        sleepAnalytics: null,
        activities: fetchedActivities,
      });

      // Buscar dados de sono de forma assíncrona sem bloquear o resto
      fetchSleepData().then(sleepData => {
        setSleepAnalytics(sleepData);
        
        // Atualizar cache com dados de sono
        const existingCache = getCachedData();
        if (existingCache) {
          setCachedData({
            ...existingCache,
            sleepAnalytics: sleepData,
          });
        }
      }).catch(err => {
        console.error('Error fetching sleep data:', err);
        setSleepAnalytics({
          sleepScore: null,
          lastSleepDate: null,
          hoursSlept: null,
          qualityComment: 'Dados de sono não disponíveis.',
          deepSleepPercentage: 0,
          lightSleepPercentage: 0,
          remSleepPercentage: 0,
          totalSleepMinutes: 0,
        });
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchSleepData = async (): Promise<SleepAnalytics> => {
    if (!user) {
      return {
        sleepScore: null,
        lastSleepDate: null,
        hoursSlept: null,
        qualityComment: 'Dados de sono não disponíveis.',
        deepSleepPercentage: 0,
        lightSleepPercentage: 0,
        remSleepPercentage: 0,
        totalSleepMinutes: 0,
      };
    }

    try {
      // Usar timeout para evitar travamento
      const timeoutPromise = new Promise<SleepAnalytics>((_, reject) => {
        setTimeout(() => reject(new Error('Sleep data fetch timeout')), 5000);
      });

      const fetchPromise = (async () => {
        // 1) Tenta Garmin primeiro (com limit otimizado)
        const { data: garminSleep, error: garminError } = await supabase
          .from('garmin_sleep_summaries')
          .select('calendar_date,sleep_time_in_seconds,deep_sleep_duration_in_seconds,light_sleep_duration_in_seconds,rem_sleep_duration_in_seconds,sleep_score')
          .eq('user_id', user.id)
          .order('calendar_date', { ascending: false })
          .limit(1)
          .maybeSingle();

      if (!garminError && garminSleep) {
        const totalSleepSeconds = garminSleep.sleep_time_in_seconds || 0;
        const hours = Math.floor(totalSleepSeconds / 3600);
        const minutes = Math.floor((totalSleepSeconds % 3600) / 60);
        const hoursSlept = `${hours}h ${minutes}m`;

        const deepSeconds = garminSleep.deep_sleep_duration_in_seconds || 0;
        const lightSeconds = garminSleep.light_sleep_duration_in_seconds || 0;
        const remSeconds = garminSleep.rem_sleep_duration_in_seconds || 0;
        const totalSeconds = deepSeconds + lightSeconds + remSeconds;

        const deepPercentage = totalSeconds > 0 ? Math.round((deepSeconds / totalSeconds) * 100) : 0;
        const lightPercentage = totalSeconds > 0 ? Math.round((lightSeconds / totalSeconds) * 100) : 0;
        const remPercentage = totalSeconds > 0 ? Math.round((remSeconds / totalSeconds) * 100) : 0;

        const sleepScore = garminSleep.sleep_score || 0;
        let qualityComment = '';
        if (sleepScore >= 80) qualityComment = 'Excelente qualidade de sono! Você teve uma noite muito restauradora.';
        else if (sleepScore >= 70) qualityComment = 'Boa qualidade de sono. Algumas melhorias podem ser feitas.';
        else if (sleepScore >= 60) qualityComment = 'Qualidade regular. Considere melhorar sua rotina de sono.';
        else if (sleepScore > 0) qualityComment = 'Sono de baixa qualidade. É importante priorizar o descanso.';
        else qualityComment = 'Score de sono não disponível para esta noite.';

        const lastSleepDate = new Date(garminSleep.calendar_date).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        return {
          sleepScore,
          lastSleepDate,
          hoursSlept,
          qualityComment,
          deepSleepPercentage: deepPercentage,
          lightSleepPercentage: lightPercentage,
          remSleepPercentage: remPercentage,
          totalSleepMinutes: Math.round(totalSleepSeconds / 60),
        };
      }

      // 2) Fallback para Polar
      const { data: polarSleep, error: polarError } = await supabase
        .from('polar_sleep')
        .select('date,deep_sleep,light_sleep,rem_sleep,total_sleep,sleep_score')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!polarError && polarSleep) {
        const deepMin = polarSleep.deep_sleep || 0;
        const lightMin = polarSleep.light_sleep || 0;
        const remMin = polarSleep.rem_sleep || 0;
        const stagesTotal = deepMin + lightMin + remMin;

        // total_sleep pode já estar em minutos. Se ausente, somamos as fases.
        let totalMinutes: number = polarSleep.total_sleep || 0;
        if (!totalMinutes || totalMinutes <= 0) totalMinutes = stagesTotal;

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const hoursSlept = `${hours}h ${minutes}m`;

        const deepPercentage = stagesTotal > 0 ? Math.round((deepMin / stagesTotal) * 100) : 0;
        const lightPercentage = stagesTotal > 0 ? Math.round((lightMin / stagesTotal) * 100) : 0;
        const remPercentage = stagesTotal > 0 ? Math.round((remMin / stagesTotal) * 100) : 0;

        const sleepScore = polarSleep.sleep_score || 0;
        let qualityComment = '';
        if (sleepScore >= 80) qualityComment = 'Excelente qualidade de sono! Você teve uma noite muito restauradora.';
        else if (sleepScore >= 70) qualityComment = 'Boa qualidade de sono. Algumas melhorias podem ser feitas.';
        else if (sleepScore >= 60) qualityComment = 'Qualidade regular. Considere melhorar sua rotina de sono.';
        else if (sleepScore > 0) qualityComment = 'Sono de baixa qualidade. É importante priorizar o descanso.';
        else qualityComment = 'Score de sono não disponível para esta noite.';

        const lastSleepDate = new Date(polarSleep.date).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        return {
          sleepScore,
          lastSleepDate,
          hoursSlept,
          qualityComment,
          deepSleepPercentage: deepPercentage,
          lightSleepPercentage: lightPercentage,
          remSleepPercentage: remPercentage,
          totalSleepMinutes: totalMinutes,
        };
      }

      // 3) Fallback para HealthKit (Apple Watch)
      const { data: hkSleep, error: hkError } = await supabase
        .from('healthkit_sleep_summaries')
        .select('calendar_date,total_sleep_seconds,deep_sleep_seconds,light_sleep_seconds,rem_sleep_seconds,awake_seconds,sleep_score')
        .eq('user_id', user.id)
        .order('calendar_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!hkError && hkSleep) {
        const totalSleepSeconds = hkSleep.total_sleep_seconds || 0;
        const hours = Math.floor(totalSleepSeconds / 3600);
        const minutes = Math.floor((totalSleepSeconds % 3600) / 60);
        const hoursSlept = `${hours}h ${minutes}m`;

        const deepSeconds = hkSleep.deep_sleep_seconds || 0;
        const lightSeconds = hkSleep.light_sleep_seconds || 0;
        const remSeconds = hkSleep.rem_sleep_seconds || 0;
        const totalSeconds = deepSeconds + lightSeconds + remSeconds;

        const deepPercentage = totalSeconds > 0 ? Math.round((deepSeconds / totalSeconds) * 100) : 0;
        const lightPercentage = totalSeconds > 0 ? Math.round((lightSeconds / totalSeconds) * 100) : 0;
        const remPercentage = totalSeconds > 0 ? Math.round((remSeconds / totalSeconds) * 100) : 0;

        const sleepScore = hkSleep.sleep_score || 0;
        let qualityComment = '';
        if (sleepScore >= 80) qualityComment = 'Excelente qualidade de sono! Você teve uma noite muito restauradora.';
        else if (sleepScore >= 70) qualityComment = 'Boa qualidade de sono. Algumas melhorias podem ser feitas.';
        else if (sleepScore >= 60) qualityComment = 'Qualidade regular. Considere melhorar sua rotina de sono.';
        else if (sleepScore > 0) qualityComment = 'Sono de baixa qualidade. É importante priorizar o descanso.';
        else qualityComment = 'Score de sono não disponível para esta noite.';

        const lastSleepDate = new Date(hkSleep.calendar_date).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        return {
          sleepScore,
          lastSleepDate,
          hoursSlept,
          qualityComment,
          deepSleepPercentage: deepPercentage,
          lightSleepPercentage: lightPercentage,
          remSleepPercentage: remPercentage,
          totalSleepMinutes: Math.round(totalSleepSeconds / 60),
        };
      }

      return {
        sleepScore: null,
        lastSleepDate: null,
        hoursSlept: null,
        qualityComment: 'Ainda não há dados de sono registrados.',
        deepSleepPercentage: 0,
        lightSleepPercentage: 0,
        remSleepPercentage: 0,
        totalSleepMinutes: 0,
      };
      })();

      // Usar Promise.race para ter timeout
      return await Promise.race([fetchPromise, timeoutPromise]);

    } catch (error) {
      console.error('Error fetching sleep data:', error);
      return {
        sleepScore: null,
        lastSleepDate: null,
        hoursSlept: null,
        qualityComment: 'Erro ao carregar dados de sono.',
        deepSleepPercentage: 0,
        lightSleepPercentage: 0,
        remSleepPercentage: 0,
        totalSleepMinutes: 0,
      };
    }
  };

  const fetchGarminVo2Max = async (userId: string, sinceDateStr: string) => {
    try {
      console.log('VO2 Max Debug - Starting fetchGarminVo2Max for userId:', userId, 'since:', sinceDateStr);
      
      // Primeiro, buscar o garmin_user_id do usuário atual
      const { data: tokens, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('garmin_user_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      console.log('VO2 Max Debug - Tokens query result:', { tokens, tokenError });

      if (tokenError || !tokens?.length || !tokens[0].garmin_user_id) {
        console.log('VO2 Max Debug - No valid tokens found');
        return [];
      }

      const garminUserId = tokens[0].garmin_user_id;
      console.log('VO2 Max Debug - Found garminUserId:', garminUserId);

      // Buscar dados de VO2 Max filtrando diretamente pelo garmin_user_id
      const { data, error } = await supabase
        .from('garmin_vo2max')
        .select('*')
        .eq('garmin_user_id', garminUserId)
        .gte('calendar_date', sinceDateStr)
        .order('calendar_date', { ascending: false });

      console.log('VO2 Max Debug - VO2 Max query result:', { data, error });

      if (error) {
        console.error('Error fetching garmin_vo2max:', error);
        return [];
      }

      console.log('VO2 Max Debug - Returning data:', data || []);
      return data || [];
    } catch (error) {
      console.error('Error in fetchGarminVo2Max:', error);
      return [];
    }
  };

  const calculateMetrics = (activities: any[], garminVo2MaxData: any[] = []): DashboardMetrics => {
    const last30Days = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return actDate >= thirtyDaysAgo;
    });

    const previous30Days = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return actDate >= sixtyDaysAgo && actDate < thirtyDaysAgo;
    });

    // VO₂ Max - Priorizar dados de garmin_vo2max
    let currentVo2 = null;
    let prevVo2 = null;

    // 1. Tentar usar garmin_vo2max primeiro (últimos 30 dias)
    const last30DaysVo2Max = garminVo2MaxData.filter(vo2 => {
      const vo2Date = new Date(vo2.calendar_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return vo2Date >= thirtyDaysAgo;
    });

    console.log('VO2 Max Debug - garminVo2MaxData:', garminVo2MaxData);
    console.log('VO2 Max Debug - last30DaysVo2Max:', last30DaysVo2Max);

    if (last30DaysVo2Max.length > 0) {
      console.log('VO2 Max Debug - Processing last30DaysVo2Max:', last30DaysVo2Max);
      
      // Iterar pelos dados ordenados por data (mais recente primeiro) e pegar o primeiro valor não-nulo
      for (const vo2Record of last30DaysVo2Max) {
        const vo2Value = vo2Record.vo2_max_running || vo2Record.vo2_max_cycling;
        if (vo2Value != null) {
          currentVo2 = vo2Value;
          console.log('VO2 Max Debug - Found non-null currentVo2 from Garmin:', currentVo2, 'from date:', vo2Record.calendar_date);
          break;
        }
      }
      
      console.log('VO2 Max Debug - Final currentVo2 from Garmin:', currentVo2);
    }

    // 2. Fallback para atividades se não houver dados de garmin_vo2max
    if (!currentVo2) {
      console.log('VO2 Max Debug - Using fallback from activities');
      const vo2Activities = last30Days.filter(act => act.vo2_max);
      currentVo2 = vo2Activities.length > 0 
        ? vo2Activities.reduce((sum, act) => sum + act.vo2_max, 0) / vo2Activities.length 
        : null;
    }

    // Período anterior (30-60 dias)
    const prev30DaysVo2Max = garminVo2MaxData.filter(vo2 => {
      const vo2Date = new Date(vo2.calendar_date);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return vo2Date >= sixtyDaysAgo && vo2Date < thirtyDaysAgo;
    });

    if (prev30DaysVo2Max.length > 0) {
      const vo2Values = prev30DaysVo2Max
        .map(vo2 => vo2.vo2_max_running || vo2.vo2_max_cycling)
        .filter(v => v != null);
      
      prevVo2 = vo2Values.length > 0 
        ? vo2Values.reduce((sum, val) => sum + val, 0) / vo2Values.length 
        : null;
    }

    if (!prevVo2) {
      const prevVo2Activities = previous30Days.filter(act => act.vo2_max);
      prevVo2 = prevVo2Activities.length > 0 
        ? prevVo2Activities.reduce((sum, act) => sum + act.vo2_max, 0) / prevVo2Activities.length 
        : null;
    }

    const vo2Change = (currentVo2 && prevVo2) ? ((currentVo2 - prevVo2) / prevVo2) * 100 : 0;

    // Frequência Cardíaca
    const hrActivities = last30Days.filter(act => act.average_heart_rate);
    const avgHR = hrActivities.length > 0 
      ? hrActivities.reduce((sum, act) => sum + (act.average_heart_rate || 0), 0) / hrActivities.length 
      : 0;

    const prevHrActivities = previous30Days.filter(act => act.average_heart_rate);
    const prevAvgHR = prevHrActivities.length > 0 
      ? prevHrActivities.reduce((sum, act) => sum + (act.average_heart_rate || 0), 0) / prevHrActivities.length
      : avgHR;

    const hrChange = avgHR > 0 ? ((avgHR - prevAvgHR) / prevAvgHR) * 100 : 0;

    // Zona de treino (baseada em % do HR máximo)
    const maxHR = Math.max(...activities.map(act => act.max_heart_rate || 0));
    const hrZonePercentage = maxHR > 0 ? (avgHR / maxHR) * 100 : 0;
    
    let currentZone = '1-2';
    if (hrZonePercentage > 85) currentZone = '4-5';
    else if (hrZonePercentage > 75) currentZone = '3-4';
    else if (hrZonePercentage > 65) currentZone = '2-3';

    // Recuperação (baseada em volume vs intensidade)
    const weeklyVolume = last30Days.length / 4; // atividades por semana
    const avgIntensity = hrZonePercentage;
    const recoveryLevel = Math.max(0, Math.min(100, 100 - (weeklyVolume * 5) - (avgIntensity - 70)));

    // Determinar fonte do VO2 Max
    let vo2Source = 'Estimado';
    if (last30DaysVo2Max.length > 0) {
      vo2Source = 'Garmin (Oficial)';
    } else if (last30Days.some(act => act.vo2_max)) {
      vo2Source = 'Calculado';
    }

    return {
      vo2Max: {
        current: currentVo2,
        change: Math.round(vo2Change),
        trend: vo2Change >= 0 ? 'up' : 'down',
        source: vo2Source
      },
      heartRate: {
        average: Math.round(avgHR),
        change: Math.round(Math.abs(hrChange)),
        trend: hrChange < 0 ? 'down' : 'up' // Menor FC é melhor
      },
      trainingZone: {
        currentZone,
        percentage: Math.round(hrZonePercentage),
        trend: 'up'
      },
      recovery: {
        level: Math.round(recoveryLevel),
        change: Math.round(Math.random() * 10), // Simplificado
        trend: 'up'
      },
      bioPeakFitness: {
        score: currentScore?.fitness_score || null,
        change: getScoreTrend().change,
        trend: getScoreTrend().trend as 'up' | 'down' | 'stable',
        label: currentScore?.fitness_score ? getScoreLabel(currentScore.fitness_score).label : 'N/A',
        components: currentScore ? {
          capacity: currentScore.capacity_score,
          consistency: currentScore.consistency_score,
          recovery: currentScore.recovery_balance_score,
        } : undefined,
      }
    };
  };

  const calculateActivityDistribution = (activities: any[]): ActivityDistribution[] => {
    // Contar atividades por tipo
    const typeCounts: { [key: string]: number } = {};
    
    activities.forEach(activity => {
      const type = activity.activity_type || 'Outros';
      
      // Normalizar nomes de atividades
      let normalizedType = type;
      if (type.toLowerCase().includes('run')) {
        normalizedType = 'Corrida';
      } else if (type.toLowerCase().includes('bike') || type.toLowerCase().includes('cycling')) {
        normalizedType = 'Ciclismo';
      } else if (type.toLowerCase().includes('swim')) {
        normalizedType = 'Natação';
      } else if (type.toLowerCase().includes('walk')) {
        normalizedType = 'Caminhada';
      } else if (type.toLowerCase().includes('strength') || type.toLowerCase().includes('weight')) {
        normalizedType = 'Musculação';
      } else if (type.toLowerCase().includes('yoga')) {
        normalizedType = 'Yoga';
      } else if (type.toLowerCase().includes('cardio')) {
        normalizedType = 'Cardio';
      } else {
        normalizedType = 'Outros';
      }
      
      typeCounts[normalizedType] = (typeCounts[normalizedType] || 0) + 1;
    });

    const total = activities.length;
    const colors = [
      '#10b981', // green-500 - Corrida
      '#f59e0b', // amber-500 - Ciclismo  
      '#06b6d4', // cyan-500 - Natação
      '#8b5cf6', // violet-500 - Caminhada
      '#ef4444', // red-500 - Musculação
      '#ec4899', // pink-500 - Yoga
      '#6366f1', // indigo-500 - Cardio
      '#64748b'  // slate-500 - Outros
    ];

    const distribution = Object.entries(typeCounts)
      .map(([type, count], index) => ({
        name: type,
        value: count,
        percentage: Math.round((count / total) * 100),
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.value - a.value); // Ordenar por quantidade

    return distribution;
  };

  const generateAlerts = (activities: any[]): Alert[] => {
    const alerts: Alert[] = [];
    const last7Days = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return actDate >= sevenDaysAgo;
    });

    // Verificar overtraining
    if (last7Days.length > 5) {
      const avgHR = last7Days.reduce((sum, act) => sum + (act.average_heart_rate || 0), 0) / last7Days.length;
      if (avgHR > 160) {
        alerts.push({
          type: 'warning',
          title: 'Risco de Overtraining',
          message: 'Alta frequência de treinos intensos. Considere um dia de recuperação.',
          priority: 'high'
        });
      }
    }

    // Verificar melhora de VO₂ Max
    const vo2Activities = activities.filter(act => act.vo2_max).slice(0, 10);
    if (vo2Activities.length >= 5) {
      const recent = vo2Activities.slice(0, 5).reduce((sum, act) => sum + act.vo2_max, 0) / 5;
      const older = vo2Activities.slice(5, 10).reduce((sum, act) => sum + act.vo2_max, 0) / 5;
      
      if (recent > older * 1.02) {
        alerts.push({
          type: 'success',
          title: 'Performance em Alta',
          message: `Seu VO₂ Max melhorou ${Math.round(((recent - older) / older) * 100)}% recentemente.`,
          priority: 'medium'
        });
      }
    }

    // Verificar consistência
    if (last7Days.length === 0) {
      alerts.push({
        type: 'info',
        title: 'Retome os Treinos',
        message: 'Você não registrou atividades esta semana. Que tal uma corrida hoje?',
        priority: 'medium'
      });
    }

    return alerts;
  };

  const formatRecentActivities = (activities: any[]): RecentActivity[] => {
    return activities.slice(0, 5).map(activity => {
      const date = activity.activity_date ? new Date(activity.activity_date).toLocaleDateString('pt-BR') : 'Data N/A';
      const type = getActivityTypeLabel(activity.activity_type);
      
      // Mapear corretamente os campos da tabela all_activities
      const totalTimeMinutes = activity.total_time_minutes || 0;
      const duration = totalTimeMinutes > 0 ? 
        `${Math.floor(totalTimeMinutes)}min` : 'N/A';
      
      const distance = activity.total_distance_meters ? 
        `${(activity.total_distance_meters / 1000).toFixed(1)}km` : 'N/A';
      
      // Para natação, mostrar velocidade ou tempo por 100m ao invés de pace
      const isSwimming = activity.activity_type?.toLowerCase().includes('swim');
      const avgPace = isSwimming 
        ? (activity.total_distance_meters && totalTimeMinutes > 0 
          ? `${((totalTimeMinutes * 60) / (activity.total_distance_meters / 100)).toFixed(1)}s/100m`
          : duration)
        : (activity.pace_min_per_km ? 
          `${Math.floor(activity.pace_min_per_km)}:${String(Math.round((activity.pace_min_per_km % 1) * 60)).padStart(2, '0')}/km` 
          : 'N/A');

      // Simular avaliação de performance baseada no pace
      let performance: 'Excelente' | 'Bom' | 'Regular' = 'Regular';
      if (activity.pace_min_per_km && activity.pace_min_per_km < 5) {
        performance = 'Excelente';
      } else if (activity.pace_min_per_km && activity.pace_min_per_km < 6) {
        performance = 'Bom';
      }

      return {
        date,
        type,
        duration,
        distance,
        avgPace,
        performance,
        color: getActivityColor(activity.activity_type)
      };
    });
  };

  // Helper functions para labelização e cores
  const getActivityTypeLabel = (type: string | null): string => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'RUNNING': 'Corrida',
      'Run': 'Corrida',
      'running': 'Corrida',
      'CYCLING': 'Ciclismo',
      'Ride': 'Ciclismo', 
      'cycling': 'Ciclismo',
      'WALKING': 'Caminhada',
      'Walk': 'Caminhada',
      'walking': 'Caminhada',
      'SWIMMING': 'Natação',
      'Swim': 'Natação',
      'swimming': 'Natação',
      'FITNESS_EQUIPMENT': 'Academia',
      'Workout': 'Academia'
    };
    return typeMap[type] || type;
  };

  const getActivityColor = (type: string | null): string => {
    if (!type) return 'bg-gray-500';
    const typeKey = type.toLowerCase();
    if (typeKey.includes('run')) return 'bg-green-500';
    if (typeKey.includes('bike') || typeKey.includes('cycling')) return 'bg-orange-500';
    if (typeKey.includes('swim')) return 'bg-cyan-500';
    if (typeKey.includes('walk')) return 'bg-purple-500';
    if (typeKey.includes('strength') || typeKey.includes('workout')) return 'bg-red-500';
    return 'bg-blue-500';
  };

  const calculatePeakPerformance = (activities: any[]): PeakPerformance => {
    // Helper: estima VO2max para corridas quando não há vo2_max (ex.: Strava)
    const estimateVo2Max = (act: any): number | null => {
      const type = (act.activity_type || '').toLowerCase();
      if (!type.includes('run')) return null; // apenas corrida

      const paceMinPerKm = act.pace_min_per_km;
      const avgHr = act.average_heart_rate;
      const maxHr = act.max_heart_rate;

      if (!paceMinPerKm || paceMinPerKm <= 0 || !avgHr || avgHr <= 0 || !maxHr || maxHr <= 0) {
        return null;
      }

      // Mesma lógica do DB function public.calculate_vo2_max
      const calibrationFactor = 16;
      const speedMPerMin = 1000 / Number(paceMinPerKm);
      const vo2Theoretical = 3.5 * speedMPerMin;
      const effortRatio = Number(avgHr) / Number(maxHr);
      const vo2Result = vo2Theoretical / effortRatio / calibrationFactor;
      return Math.round(vo2Result * 10) / 10; // 1 casa decimal
    };

    // Construir série de VO2 usando valor real ou estimado
    const withVo2 = activities
      .map((a) => {
        const vo2 = (a.vo2_max != null ? Number(a.vo2_max) : estimateVo2Max(a));
        const dateStr = a.activity_date || a.start_date || a.start_time;
        const date = dateStr ? new Date(dateStr) : new Date(0);
        return vo2 && vo2 > 0 ? { vo2, date } : null;
      })
      .filter(Boolean) as { vo2: number; date: Date }[];

    if (withVo2.length === 0) {
      return {
        current: 0,
        prediction: 'Dados insuficientes',
        potential: 0,
      };
    }

    // Ordenar por mais recente e usar os últimos 5
    withVo2.sort((a, b) => b.date.getTime() - a.date.getTime());
    const recent = withVo2.slice(0, 5);
    const currentAvg = recent.reduce((sum, x) => sum + x.vo2, 0) / recent.length;

    // Mantém mesma regra do cálculo existente (15% potencial)
    const potential = Math.min(100, currentAvg * 1.15);
    const currentPercentage = (currentAvg / potential) * 100;

    // Tendência de crescimento baseada na série recente
    const growth = recent.length > 1 ? (recent[0].vo2 - recent[recent.length - 1].vo2) / recent.length : 0;
    const weeksToTarget = growth > 0 ? Math.ceil((potential - currentAvg) / growth) : 12;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weeksToTarget * 7);

    return {
      current: Math.round(currentPercentage),
      prediction: targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      potential: Math.round(potential),
    };
  };


  // Helpers para normalizar dados do Polar
  function parseISODurationToSeconds(iso: string | number | null | undefined): number | null {
    if (iso == null) return null;
    try {
      if (typeof iso === 'number') return Math.round(iso);
      const s = String(iso).trim();
      if (!s) return null;

      // Caso 1: segundos em string (ex: "1313" ou "1313.5")
      if (/^\d+(?:\.\d+)?$/.test(s)) {
        return Math.round(parseFloat(s));
      }

      // Caso 2: formato HH:MM:SS
      const hms = s.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
      if (hms) {
        const h = parseInt(hms[1], 10);
        const m = parseInt(hms[2], 10);
        const sec = parseInt(hms[3], 10);
        return h * 3600 + m * 60 + sec;
      }

      // Caso 3: ISO8601 (ex: PT54.649S, PT20M10S, PT1H)
      const match = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
      if (match) {
        const days = parseInt(match[1] || '0', 10);
        const hours = parseInt(match[2] || '0', 10);
        const minutes = parseInt(match[3] || '0', 10);
        const seconds = parseFloat(match[4] || '0');
        return Math.round(days * 86400 + hours * 3600 + minutes * 60 + seconds);
      }

      return null;
    } catch {
      return null;
    }
  }

  function normalizePolarActivity(p: any) {
    const activity_date = p.start_time ? new Date(p.start_time).toISOString().split('T')[0] : null;
    const duration_in_seconds = parseISODurationToSeconds(p.duration) ?? null;
    const distance_in_meters = p.distance != null ? Number(p.distance) : null;
    const average_speed_in_meters_per_second = duration_in_seconds && distance_in_meters
      ? distance_in_meters / duration_in_seconds
      : null;

    const typeRaw = p.activity_type || p.sport || p.detailed_sport_info || 'Outros';

    return {
      ...p,
      activity_date,
      duration_in_seconds,
      distance_in_meters,
      average_speed_in_meters_per_second: average_speed_in_meters_per_second ?? undefined,
      average_heart_rate_in_beats_per_minute: p.average_heart_rate_bpm ?? null,
      max_heart_rate_in_beats_per_minute: p.maximum_heart_rate_bpm ?? null,
      active_kilocalories: p.calories ?? null,
      activity_type: typeRaw,
      vo2_max: null,
    };
  }

  function normalizeStravaActivity(s: any) {
    const activity_date = s.start_date ? new Date(s.start_date).toISOString().split('T')[0] : null;
    const duration_in_seconds = s.moving_time != null ? Number(s.moving_time) : null;
    const distance_in_meters = s.distance != null ? Number(s.distance) : null;
    const average_speed_in_meters_per_second = s.average_speed != null ? Number(s.average_speed) : (
      duration_in_seconds && distance_in_meters ? distance_in_meters / duration_in_seconds : null
    );
    const average_pace_in_minutes_per_kilometer = average_speed_in_meters_per_second && average_speed_in_meters_per_second > 0
      ? (1000 / 60) / average_speed_in_meters_per_second
      : null;

    const typeRaw = s.type || 'Outros';

    return {
      ...s,
      activity_date,
      duration_in_seconds,
      distance_in_meters,
      average_speed_in_meters_per_second: average_speed_in_meters_per_second ?? undefined,
      average_pace_in_minutes_per_kilometer,
      average_heart_rate_in_beats_per_minute: s.average_heartrate ?? null,
      max_heart_rate_in_beats_per_minute: s.max_heartrate ?? null,
      active_kilocalories: s.calories ?? null,
      activity_type: typeRaw,
      vo2_max: null,
    };
  }

  function normalizeGpxActivity(g: any) {
    const activity_date = g.start_time ? new Date(g.start_time).toISOString().split('T')[0] : null;
    const duration_in_seconds = g.duration_in_seconds != null ? Number(g.duration_in_seconds) : null;
    const distance_in_meters = g.distance_in_meters != null ? Number(g.distance_in_meters) : null;

    let average_speed_in_meters_per_second = g.average_speed_in_meters_per_second != null
      ? Number(g.average_speed_in_meters_per_second)
      : null;
    if (!average_speed_in_meters_per_second && duration_in_seconds && distance_in_meters) {
      average_speed_in_meters_per_second = distance_in_meters / duration_in_seconds;
    }

    const average_pace_in_minutes_per_kilometer = g.average_pace_in_minutes_per_kilometer != null
      ? Number(g.average_pace_in_minutes_per_kilometer)
      : (average_speed_in_meters_per_second && average_speed_in_meters_per_second > 0
        ? (1000 / 60) / average_speed_in_meters_per_second
        : null);

    return {
      ...g,
      activity_date,
      duration_in_seconds,
      distance_in_meters,
      average_speed_in_meters_per_second: average_speed_in_meters_per_second ?? undefined,
      average_pace_in_minutes_per_kilometer,
      average_heart_rate_in_beats_per_minute: g.average_heart_rate ?? null,
      max_heart_rate_in_beats_per_minute: g.max_heart_rate ?? null,
      active_kilocalories: g.calories ?? null,
      activity_type: g.activity_type || 'Outros',
      vo2_max: null,
    };
  }

  return {
    metrics,
    activityDistribution,
    alerts,
    recentActivities,
    peakPerformance,
    overtrainingRisk: calculatedOvertrainingRisk,
    sleepAnalytics,
    loading,
    error,
    refetch: () => fetchDashboardData(true),
    clearCache,
  };
}