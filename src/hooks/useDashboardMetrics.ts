import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DashboardMetrics {
  vo2Max: {
    current: number | null;
    change: number;
    trend: 'up' | 'down';
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

interface OvertrainingRisk {
  level: 'baixo' | 'medio' | 'alto';
  score: number;
  factors: string[];
  recommendation: string;
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activityDistribution, setActivityDistribution] = useState<ActivityDistribution[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [peakPerformance, setPeakPerformance] = useState<PeakPerformance | null>(null);
  const [overtrainingRisk, setOvertrainingRisk] = useState<OvertrainingRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Buscar atividades dos últimos 60 dias
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: activities, error: activitiesError } = await supabase
        .from('garmin_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('activity_date', sixtyDaysAgo.toISOString().split('T')[0])
        .order('activity_date', { ascending: false });

      if (activitiesError) throw activitiesError;

      if (!activities || activities.length === 0) {
        setMetrics(null);
        setActivityDistribution([]);
        setAlerts([]);
        setRecentActivities([]);
        setPeakPerformance(null);
        setOvertrainingRisk(null);
        return;
      }

      // Calcular métricas principais
      const calculatedMetrics = calculateMetrics(activities);
      setMetrics(calculatedMetrics);

      // Calcular distribuição de atividades
      const distribution = calculateActivityDistribution(activities);
      setActivityDistribution(distribution);

      // Gerar alertas inteligentes
      const intelligentAlerts = generateAlerts(activities);
      setAlerts(intelligentAlerts);

      // Buscar atividades recentes
      const recentActs = formatRecentActivities(activities.slice(0, 5));
      setRecentActivities(recentActs);

      // Calcular pico de performance
      const peak = calculatePeakPerformance(activities);
      setPeakPerformance(peak);

      // Calcular risco de overtraining
      const overtraining = calculateOvertrainingRisk(activities);
      setOvertrainingRisk(overtraining);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (activities: any[]): DashboardMetrics => {
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

    // VO₂ Max
    const vo2Activities = last30Days.filter(act => act.vo2_max);
    const currentVo2 = vo2Activities.length > 0 
      ? vo2Activities.reduce((sum, act) => sum + act.vo2_max, 0) / vo2Activities.length 
      : null;

    const prevVo2Activities = previous30Days.filter(act => act.vo2_max);
    const prevVo2 = prevVo2Activities.length > 0 
      ? prevVo2Activities.reduce((sum, act) => sum + act.vo2_max, 0) / prevVo2Activities.length 
      : null;

    const vo2Change = (currentVo2 && prevVo2) ? ((currentVo2 - prevVo2) / prevVo2) * 100 : 0;

    // Frequência Cardíaca
    const hrActivities = last30Days.filter(act => act.average_heart_rate_in_beats_per_minute);
    const avgHR = hrActivities.length > 0 
      ? hrActivities.reduce((sum, act) => sum + act.average_heart_rate_in_beats_per_minute, 0) / hrActivities.length 
      : 0;

    const prevHrActivities = previous30Days.filter(act => act.average_heart_rate_in_beats_per_minute);
    const prevAvgHR = prevHrActivities.length > 0 
      ? prevHrActivities.reduce((sum, act) => sum + act.average_heart_rate_in_beats_per_minute, 0) / prevHrActivities.length 
      : avgHR;

    const hrChange = avgHR > 0 ? ((avgHR - prevAvgHR) / prevAvgHR) * 100 : 0;

    // Zona de treino (baseada em % do HR máximo)
    const maxHR = Math.max(...activities.map(act => act.max_heart_rate_in_beats_per_minute || 0));
    const hrZonePercentage = maxHR > 0 ? (avgHR / maxHR) * 100 : 0;
    
    let currentZone = '1-2';
    if (hrZonePercentage > 85) currentZone = '4-5';
    else if (hrZonePercentage > 75) currentZone = '3-4';
    else if (hrZonePercentage > 65) currentZone = '2-3';

    // Recuperação (baseada em volume vs intensidade)
    const weeklyVolume = last30Days.length / 4; // atividades por semana
    const avgIntensity = hrZonePercentage;
    const recoveryLevel = Math.max(0, Math.min(100, 100 - (weeklyVolume * 5) - (avgIntensity - 70)));

    return {
      vo2Max: {
        current: currentVo2,
        change: Math.round(vo2Change),
        trend: vo2Change >= 0 ? 'up' : 'down'
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
      const avgHR = last7Days.reduce((sum, act) => sum + (act.average_heart_rate_in_beats_per_minute || 0), 0) / last7Days.length;
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
    return activities.map(act => {
      const duration = act.duration_in_seconds 
        ? `${Math.floor(act.duration_in_seconds / 3600)}:${String(Math.floor((act.duration_in_seconds % 3600) / 60)).padStart(2, '0')}:${String(act.duration_in_seconds % 60).padStart(2, '0')}`
        : 'N/A';
      
      const distance = act.distance_in_meters 
        ? `${(act.distance_in_meters / 1000).toFixed(1)} km`
        : 'N/A';
      
      const avgPace = act.average_pace_in_minutes_per_kilometer 
        ? `${Math.floor(act.average_pace_in_minutes_per_kilometer)}:${String(Math.round((act.average_pace_in_minutes_per_kilometer % 1) * 60)).padStart(2, '0')}/km`
        : act.average_speed_in_meters_per_second 
        ? `${(act.average_speed_in_meters_per_second * 3.6).toFixed(1)} km/h`
        : 'N/A';

      // Determinar performance baseada em VO₂ Max ou HR
      let performance: 'Excelente' | 'Bom' | 'Regular' = 'Regular';
      if (act.vo2_max && act.vo2_max > 45) performance = 'Excelente';
      else if (act.vo2_max && act.vo2_max > 35) performance = 'Bom';
      else if (act.average_heart_rate_in_beats_per_minute && act.average_heart_rate_in_beats_per_minute > 150) performance = 'Bom';

      // Cor baseada no tipo de atividade
      let color = 'bg-blue-500';
      if (act.activity_type?.toLowerCase().includes('run')) color = 'bg-green-500';
      else if (act.activity_type?.toLowerCase().includes('bike') || act.activity_type?.toLowerCase().includes('cycling')) color = 'bg-orange-500';
      else if (act.activity_type?.toLowerCase().includes('swim')) color = 'bg-cyan-500';

      return {
        date: new Date(act.activity_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        type: act.activity_type || 'Atividade',
        duration,
        distance,
        avgPace,
        performance,
        color
      };
    });
  };

  const calculatePeakPerformance = (activities: any[]): PeakPerformance => {
    const vo2Activities = activities.filter(act => act.vo2_max);
    
    if (vo2Activities.length === 0) {
      return {
        current: 0,
        prediction: 'Dados insuficientes',
        potential: 0
      };
    }

    // Calcular tendência dos últimos VO₂ Max
    const recentVo2 = vo2Activities.slice(0, 5);
    const currentAvg = recentVo2.reduce((sum, act) => sum + act.vo2_max, 0) / recentVo2.length;
    
    // Estimar potencial baseado na tendência
    const potential = Math.min(100, currentAvg * 1.15); // 15% de margem de melhora
    const currentPercentage = (currentAvg / potential) * 100;

    // Prever quando atingir o pico
    const growth = recentVo2.length > 1 ? (recentVo2[0].vo2_max - recentVo2[recentVo2.length - 1].vo2_max) / recentVo2.length : 0;
    const weeksToTarget = growth > 0 ? Math.ceil((potential - currentAvg) / growth) : 12;
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weeksToTarget * 7));

    return {
      current: Math.round(currentPercentage),
      prediction: targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      potential: Math.round(potential)
    };
  };

  const calculateOvertrainingRisk = (activities: any[]): OvertrainingRisk => {
    const last7Days = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return actDate >= sevenDaysAgo;
    });

    const last14Days = activities.filter(act => {
      const actDate = new Date(act.activity_date);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      return actDate >= fourteenDaysAgo;
    });

    let score = 0;
    const factors: string[] = [];

    // Fator 1: Frequência de treinos (30% do score)
    const weeklyFrequency = last7Days.length;
    if (weeklyFrequency > 6) {
      score += 30;
      factors.push('Frequência muito alta (>6 treinos/semana)');
    } else if (weeklyFrequency > 4) {
      score += 15;
      factors.push('Frequência alta (4-6 treinos/semana)');
    }

    // Fator 2: Intensidade média (25% do score)
    const highIntensityActivities = last7Days.filter(act => {
      const avgHR = act.average_heart_rate_in_beats_per_minute || 0;
      const maxHR = act.max_heart_rate_in_beats_per_minute || 0;
      return maxHR > 0 && (avgHR / maxHR) > 0.85;
    });

    const intensityPercentage = last7Days.length > 0 ? (highIntensityActivities.length / last7Days.length) * 100 : 0;
    if (intensityPercentage > 50) {
      score += 25;
      factors.push('Muitos treinos de alta intensidade (>50%)');
    } else if (intensityPercentage > 30) {
      score += 12;
      factors.push('Intensidade moderada-alta');
    }

    // Fator 3: Falta de recuperação (20% do score)
    const avgRestDays = 7 - weeklyFrequency;
    if (avgRestDays < 1) {
      score += 20;
      factors.push('Falta de dias de descanso');
    } else if (avgRestDays < 2) {
      score += 10;
      factors.push('Poucos dias de recuperação');
    }

    // Fator 4: Duração excessiva (15% do score)
    const longActivities = last7Days.filter(act => (act.duration_in_seconds || 0) > 7200); // >2h
    if (longActivities.length > 2) {
      score += 15;
      factors.push('Múltiplas sessões longas (>2h)');
    } else if (longActivities.length > 0) {
      score += 7;
      factors.push('Algumas sessões longas');
    }

    // Fator 5: Tendência crescente (10% do score)
    const weeklyIncrease = last7Days.length > last14Days.length / 2;
    if (weeklyIncrease) {
      score += 10;
      factors.push('Aumento súbito no volume');
    }

    // Determinar nível de risco
    let level: 'baixo' | 'medio' | 'alto' = 'baixo';
    let recommendation = 'Continue com seu plano atual de treinos.';

    if (score >= 60) {
      level = 'alto';
      recommendation = 'Considere reduzir volume e intensidade. Inclua mais dias de recuperação.';
    } else if (score >= 30) {
      level = 'medio';
      recommendation = 'Monitore sinais de fadiga. Considere incluir mais recuperação ativa.';
    }

    return {
      level,
      score: Math.min(100, score),
      factors: factors.length > 0 ? factors : ['Sem fatores de risco identificados'],
      recommendation
    };
  };

  return {
    metrics,
    activityDistribution,
    alerts,
    recentActivities,
    peakPerformance,
    overtrainingRisk,
    loading,
    error,
    refetch: fetchDashboardData
  };
}