import { useMemo } from 'react';

export interface OvertrainingRisk {
  level: 'baixo' | 'medio' | 'alto';
  score: number;
  factors: string[];
  recommendation: string;
}

export const useOvertrainingRisk = (activities: any[]) => {
  return useMemo(() => {
    return calculateOvertrainingRisk(activities);
  }, [activities]);
};

function calculateOvertrainingRisk(activities: any[]): OvertrainingRisk {
  if (activities.length === 0) {
    return {
      score: 0,
      level: 'baixo',
      factors: ['Dados insuficientes para análise'],
      recommendation: 'Inicie sua jornada de treinos gradualmente.'
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

  // Determinar nível de risco e recomendações
  let level: 'baixo' | 'medio' | 'alto' = 'baixo';
  let recommendation = 'Continue com seu plano atual, mantendo equilíbrio entre treino e recuperação.';

  if (score >= 50) {
    level = 'alto';
    recommendation = 'ATENÇÃO: Risco alto de overtraining. Reduza volume/intensidade, aumente recuperação e considere consultar um profissional.';
  } else if (score >= 25) {
    level = 'medio';
    recommendation = 'Monitore sinais de fadiga. Inclua mais recuperação ativa e evite aumentos súbitos de carga.';
  }

  return {
    level,
    score: Math.min(100, score),
    factors: factors.length > 0 ? factors : ['Carga de treino equilibrada'],
    recommendation
  };
}

// Função auxiliar para calcular dias consecutivos
function getConsecutiveTrainingDays(activities: any[]): number {
  if (activities.length === 0) return 0;
  
  console.log('getConsecutiveTrainingDays - Input activities:', activities.map(act => ({
    date: act.activity_date,
    duration: act.duration_in_seconds,
    calories: act.active_kilocalories,
    type: act.activity_type
  })));
  
  // Filtrar atividades insignificantes (menos de 5 minutos ou 10 calorias)
  const significantActivities = activities.filter(act => {
    const duration = act.duration_in_seconds || 0;
    const calories = act.active_kilocalories || 0;
    return duration >= 300 || calories >= 10; // 5 minutos ou 10+ calorias
  });
  
  console.log('getConsecutiveTrainingDays - Significant activities:', significantActivities.length);
  
  if (significantActivities.length === 0) return 0;
  
  // Extrair datas únicas e ordenar da mais recente para a mais antiga
  const uniqueDates = [...new Set(significantActivities.map(act => act.activity_date))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
  console.log('getConsecutiveTrainingDays - Unique dates (recent to old):', uniqueDates);
  
  if (uniqueDates.length <= 1) return uniqueDates.length;
  
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  
  // Verificar sequências consecutivas
  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i-1]);
    const previousDate = new Date(uniqueDates[i]);
    
    // Calcular diferença em dias (deve ser exatamente 1 dia para ser consecutivo)
    const timeDiff = currentDate.getTime() - previousDate.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    console.log(`getConsecutiveTrainingDays - Comparing ${uniqueDates[i-1]} and ${uniqueDates[i]}: ${daysDiff} days diff`);
    
    if (daysDiff === 1) {
      // Dias consecutivos
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      // Quebra na sequência - resetar contador
      currentConsecutive = 1;
    }
  }
  
  console.log('getConsecutiveTrainingDays - Max consecutive days:', maxConsecutive);
  return maxConsecutive;
}