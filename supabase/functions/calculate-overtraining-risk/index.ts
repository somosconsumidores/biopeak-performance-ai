import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OvertrainingRisk {
  level: 'low' | 'medium' | 'high';
  score: number;
  factors: string[];
  recommendation: string;
  training_load_score: number;
  frequency_score: number;
  intensity_score: number;
  volume_trend_score: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { user_id, days_to_analyze = 30 } = await req.json();
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculating overtraining risk for user: ${user_id}, analyzing ${days_to_analyze} days`);

    // Fetch activities from the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_to_analyze);
    
    const { data: activities, error: activitiesError } = await supabase
      .from('v_all_activities_with_vo2_daniels')
      .select('*')
      .eq('user_id', user_id)
      .gte('activity_date', startDate.toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      throw activitiesError;
    }

    if (!activities || activities.length === 0) {
      console.log('No activities found for user');
      return new Response(
        JSON.stringify({ 
          error: 'No activities found',
          message: 'User has no activities in the specified time range'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${activities.length} activities to analyze`);

    // Calculate overtraining risk
    const risk = calculateOvertrainingRisk(activities);

    // Save to database
    const { data: savedScore, error: saveError } = await supabase
      .from('overtraining_scores')
      .insert({
        user_id,
        score: risk.score,
        level: risk.level,
        factors: risk.factors,
        recommendation: risk.recommendation,
        training_load_score: risk.training_load_score,
        frequency_score: risk.frequency_score,
        intensity_score: risk.intensity_score,
        volume_trend_score: risk.volume_trend_score,
        activities_analyzed: activities.length,
        days_analyzed: days_to_analyze
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving overtraining score:', saveError);
      throw saveError;
    }

    console.log('Overtraining risk calculated and saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: savedScore,
        risk
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-overtraining-risk:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateOvertrainingRisk(activities: any[]): OvertrainingRisk {
  if (!activities || activities.length === 0) {
    return {
      level: 'low',
      score: 0,
      factors: ['Dados insuficientes'],
      recommendation: 'Continue registrando suas atividades para análise',
      training_load_score: 0,
      frequency_score: 0,
      intensity_score: 0,
      volume_trend_score: 0,
    };
  }

  let totalScore = 0;
  const factors: string[] = [];
  
  // Weights for each factor
  const TRAINING_LOAD_WEIGHT = 0.35;
  const FREQUENCY_WEIGHT = 0.25;
  const INTENSITY_WEIGHT = 0.20;
  const VOLUME_TREND_WEIGHT = 0.20;

  // 1. Training Load Analysis (35% weight)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentActivities = activities.filter(
    a => new Date(a.activity_date) >= oneWeekAgo
  );

  const monthlyActivities = activities.filter(
    a => new Date(a.activity_date) >= oneMonthAgo
  );

  const weeklyLoad = recentActivities.reduce(
    (sum, a) => sum + (a.total_time_minutes || 0) * (a.average_heart_rate || 100) / 100,
    0
  );

  const avgMonthlyLoad = monthlyActivities.length > 0
    ? monthlyActivities.reduce(
        (sum, a) => sum + (a.total_time_minutes || 0) * (a.average_heart_rate || 100) / 100,
        0
      ) / Math.ceil(monthlyActivities.length / 4)
    : weeklyLoad;

  const loadRatio = avgMonthlyLoad > 0 ? weeklyLoad / avgMonthlyLoad : 1;
  let trainingLoadScore = 0;

  if (loadRatio > 1.5) {
    trainingLoadScore = 100;
    factors.push('Carga de treino muito acima da média mensal');
  } else if (loadRatio > 1.3) {
    trainingLoadScore = 75;
    factors.push('Carga de treino significativamente aumentada');
  } else if (loadRatio > 1.15) {
    trainingLoadScore = 50;
    factors.push('Carga de treino moderadamente elevada');
  } else if (loadRatio > 1.0) {
    trainingLoadScore = 25;
  }

  totalScore += trainingLoadScore * TRAINING_LOAD_WEIGHT;

  // 2. Frequency and Recovery Analysis (25% weight)
  const trainingsPerWeek = recentActivities.length;
  const consecutiveDays = getConsecutiveTrainingDays(activities);

  let frequencyScore = 0;

  if (trainingsPerWeek > 6) {
    frequencyScore += 50;
    factors.push('Treinos quase diários sem descanso adequado');
  } else if (trainingsPerWeek > 5) {
    frequencyScore += 35;
    factors.push('Frequência de treino muito alta');
  } else if (trainingsPerWeek > 4) {
    frequencyScore += 20;
  }

  if (consecutiveDays >= 7) {
    frequencyScore += 50;
    factors.push(`${consecutiveDays} dias consecutivos sem descanso`);
  } else if (consecutiveDays >= 5) {
    frequencyScore += 30;
    factors.push(`${consecutiveDays} dias consecutivos de treino`);
  } else if (consecutiveDays >= 4) {
    frequencyScore += 15;
  }

  totalScore += frequencyScore * FREQUENCY_WEIGHT;

  // 3. Accumulated Intensity (20% weight)
  const highIntensityActivities = recentActivities.filter(a => {
    const maxHR = a.max_heart_rate || 0;
    const avgHR = a.average_heart_rate || 0;
    return maxHR > 170 || avgHR > 150;
  });

  const intensityRatio = recentActivities.length > 0
    ? highIntensityActivities.length / recentActivities.length
    : 0;

  let intensityScore = 0;

  if (intensityRatio > 0.7) {
    intensityScore = 100;
    factors.push('Proporção muito alta de treinos intensos');
  } else if (intensityRatio > 0.5) {
    intensityScore = 70;
    factors.push('Muitos treinos de alta intensidade');
  } else if (intensityRatio > 0.4) {
    intensityScore = 40;
    factors.push('Intensidade de treino elevada');
  }

  totalScore += intensityScore * INTENSITY_WEIGHT;

  // 4. Volume Trend (20% weight)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const previousWeekActivities = activities.filter(
    a => new Date(a.activity_date) >= twoWeeksAgo && new Date(a.activity_date) < oneWeekAgo
  );

  const currentWeekDistance = recentActivities.reduce(
    (sum, a) => sum + (a.total_distance_meters || 0),
    0
  ) / 1000;

  const previousWeekDistance = previousWeekActivities.reduce(
    (sum, a) => sum + (a.total_distance_meters || 0),
    0
  ) / 1000;

  const volumeIncrease = previousWeekDistance > 0
    ? ((currentWeekDistance - previousWeekDistance) / previousWeekDistance) * 100
    : 0;

  let volumeTrendScore = 0;

  if (volumeIncrease > 30) {
    volumeTrendScore = 100;
    factors.push(`Aumento brusco de ${volumeIncrease.toFixed(0)}% no volume semanal`);
  } else if (volumeIncrease > 20) {
    volumeTrendScore = 70;
    factors.push(`Aumento de ${volumeIncrease.toFixed(0)}% no volume de treino`);
  } else if (volumeIncrease > 10) {
    volumeTrendScore = 40;
    factors.push('Volume de treino em crescimento acelerado');
  }

  totalScore += volumeTrendScore * VOLUME_TREND_WEIGHT;

  // Determine level and recommendation
  let level: 'low' | 'medium' | 'high';
  let recommendation: string;

  if (totalScore >= 50) {
    level = 'high';
    recommendation = 'ATENÇÃO: Risco elevado de overtraining. Considere reduzir o volume e intensidade dos treinos. Priorize descanso e recuperação ativa. Consulte seu treinador ou médico se persistirem sinais de fadiga excessiva.';
  } else if (totalScore >= 25) {
    level = 'medium';
    recommendation = 'Cuidado: Seus treinos estão intensos. Planeje dias de recuperação ativa e considere reduzir a intensidade nos próximos treinos. Monitore sinais de fadiga e qualidade do sono.';
  } else {
    level = 'low';
    recommendation = 'Seus treinos estão equilibrados. Continue mantendo uma boa relação entre treino e descanso. Sempre escute seu corpo e ajuste conforme necessário.';
  }

  if (factors.length === 0) {
    factors.push('Carga de treino adequada');
  }

  return {
    level,
    score: Math.round(totalScore),
    factors,
    recommendation,
    training_load_score: Math.round(trainingLoadScore),
    frequency_score: Math.round(frequencyScore),
    intensity_score: Math.round(intensityScore),
    volume_trend_score: Math.round(volumeTrendScore),
  };
}

function getConsecutiveTrainingDays(activities: any[]): number {
  if (activities.length === 0) return 0;

  const sortedDates = activities
    .map(a => new Date(a.activity_date))
    .sort((a, b) => b.getTime() - a.getTime());

  let maxConsecutive = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const daysDiff = Math.floor(
      (sortedDates[i - 1].getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    } else if (daysDiff > 1) {
      currentStreak = 1;
    }
  }

  return maxConsecutive;
}
