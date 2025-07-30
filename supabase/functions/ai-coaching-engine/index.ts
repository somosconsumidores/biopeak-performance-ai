import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface TrainingGoal {
  type: 'free_run' | 'target_distance' | 'target_pace' | 'target_duration' | 'target_calories';
  targetDistance?: number;
  targetPace?: number;
  targetDuration?: number;
  targetCalories?: number;
}

interface SessionProgress {
  distance: number;
  duration: number;
  pace: number;
  heartRate: number;
}

interface PerformanceData {
  snapshot_at_distance_meters: number;
  snapshot_at_duration_seconds: number;
  current_pace_min_km: number;
  current_heart_rate: number;
  deviation_from_target: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, goal, currentPerformance, sessionProgress } = await req.json() as {
      sessionId: string;
      goal: TrainingGoal;
      currentPerformance: PerformanceData;
      sessionProgress: SessionProgress;
    };

    if (!sessionId || !goal || !sessionProgress) {
      throw new Error('Missing required parameters');
    }

    console.log('AI Coaching Analysis for session:', sessionId);
    console.log('Goal:', goal);
    console.log('Current progress:', sessionProgress);

    // Analyze performance and generate feedback
    const feedback = await generateCoachingFeedback(goal, sessionProgress, currentPerformance);
    
    // Save feedback to database
    const feedbackData = {
      session_id: sessionId,
      feedback_text: feedback.message,
      triggered_at_distance_meters: sessionProgress.distance,
      triggered_at_duration_seconds: sessionProgress.duration,
      feedback_type: feedback.type,
      performance_data: {
        currentPace: sessionProgress.pace,
        currentHeartRate: sessionProgress.heartRate,
        distanceCompleted: sessionProgress.distance,
        durationElapsed: sessionProgress.duration,
        deviationAnalysis: feedback.analysis
      }
    };

    const { error: feedbackError } = await supabase
      .from('realtime_feedbacks')
      .insert(feedbackData);

    if (feedbackError) {
      console.error('Error saving feedback:', feedbackError);
    }

    // Update or create AI prescription if significant strategy change is needed
    if (feedback.strategyUpdate) {
      await updateAIPrescription(sessionId, goal, sessionProgress, feedback.strategyUpdate);
    }

    return new Response(JSON.stringify({ 
      feedback: feedback.message,
      type: feedback.type,
      analysis: feedback.analysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI coaching engine:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateCoachingFeedback(
  goal: TrainingGoal, 
  progress: SessionProgress, 
  performance: PerformanceData
) {
  const distanceKm = progress.distance / 1000;
  const durationMinutes = progress.duration / 60;
  
  // Calculate deviations from target
  let analysis = {
    paceDeviation: 0,
    distanceProgress: 0,
    timeProgress: 0,
    heartRateAnalysis: 'normal'
  };

  let feedbackMessage = '';
  let feedbackType: 'pace_adjustment' | 'motivation' | 'goal_progress' | 'heart_rate' | 'strategy_change' = 'motivation';
  let strategyUpdate = null;

  switch (goal.type) {
    case 'target_pace':
      if (goal.targetPace) {
        analysis.paceDeviation = progress.pace - goal.targetPace;
        
        if (Math.abs(analysis.paceDeviation) > 0.5) { // More than 30 seconds deviation
          if (analysis.paceDeviation > 0) {
            feedbackMessage = `Você está ${Math.abs(analysis.paceDeviation).toFixed(1)} min/km mais lento que o objetivo. Tente aumentar ligeiramente o ritmo.`;
            feedbackType = 'pace_adjustment';
          } else {
            feedbackMessage = `Você está ${Math.abs(analysis.paceDeviation).toFixed(1)} min/km mais rápido que o objetivo. Diminua um pouco o ritmo para manter sustentabilidade.`;
            feedbackType = 'pace_adjustment';
          }
        } else {
          feedbackMessage = `Perfeito! Você está mantendo o ritmo objetivo de ${goal.targetPace.toFixed(1)} min/km. Continue assim!`;
          feedbackType = 'motivation';
        }
      }
      break;

    case 'target_distance':
      if (goal.targetDistance) {
        analysis.distanceProgress = (progress.distance / goal.targetDistance) * 100;
        const remainingDistance = (goal.targetDistance - progress.distance) / 1000;
        
        if (analysis.distanceProgress >= 75) {
          feedbackMessage = `Faltam apenas ${remainingDistance.toFixed(1)}km! Você está quase lá. Mantenha o foco!`;
          feedbackType = 'motivation';
        } else if (analysis.distanceProgress >= 50) {
          feedbackMessage = `Metade do caminho concluída! ${remainingDistance.toFixed(1)}km restantes. Você está indo muito bem!`;
          feedbackType = 'goal_progress';
        } else if (analysis.distanceProgress >= 25) {
          feedbackMessage = `Bom progresso! Você já completou ${analysis.distanceProgress.toFixed(0)}% da distância objetivo.`;
          feedbackType = 'motivation';
        } else {
          feedbackMessage = `Começando bem! Mantenha esse ritmo constante pelos próximos ${remainingDistance.toFixed(1)}km.`;
          feedbackType = 'motivation';
        }
      }
      break;

    case 'target_duration':
      if (goal.targetDuration) {
        analysis.timeProgress = (progress.duration / goal.targetDuration) * 100;
        const remainingMinutes = (goal.targetDuration - progress.duration) / 60;
        
        if (analysis.timeProgress >= 80) {
          feedbackMessage = `Faltam apenas ${remainingMinutes.toFixed(0)} minutos! Finalize forte!`;
          feedbackType = 'motivation';
        } else if (analysis.timeProgress >= 50) {
          feedbackMessage = `Metade do tempo completada! Ainda ${remainingMinutes.toFixed(0)} minutos para o objetivo.`;
          feedbackType = 'goal_progress';
        } else {
          feedbackMessage = `${durationMinutes.toFixed(0)} minutos de treino. Mantenha o ritmo pelos próximos ${remainingMinutes.toFixed(0)} minutos.`;
          feedbackType = 'motivation';
        }
      }
      break;

    case 'target_calories':
      if (goal.targetCalories) {
        const caloriesProgress = (progress.distance / 1000) * 60; // Rough estimation
        const caloriesPercentage = (caloriesProgress / goal.targetCalories) * 100;
        
        if (caloriesPercentage >= 75) {
          feedbackMessage = `Excelente queima calórica! Você já queimou cerca de ${caloriesProgress.toFixed(0)} kcal.`;
          feedbackType = 'goal_progress';
        } else {
          feedbackMessage = `Continue assim! Estimativa atual: ${caloriesProgress.toFixed(0)} kcal queimadas.`;
          feedbackType = 'motivation';
        }
      }
      break;

    case 'free_run':
      // For free runs, focus on motivation and form
      if (durationMinutes > 5) {
        const messages = [
          `${durationMinutes.toFixed(0)} minutos de corrida! Como você está se sentindo?`,
          `Boa! ${distanceKm.toFixed(1)}km completados. Mantenha a postura e respiração.`,
          `Ritmo constante de ${progress.pace.toFixed(1)} min/km. Excelente controle!`,
          `Continue focado na passada e no ritmo respiratório.`
        ];
        feedbackMessage = messages[Math.floor(Math.random() * messages.length)];
        feedbackType = 'motivation';
      }
      break;
  }

  // Heart rate analysis (if available)
  if (progress.heartRate > 0) {
    if (progress.heartRate > 180) { // High HR threshold
      analysis.heartRateAnalysis = 'high';
      feedbackMessage += ' Frequência cardíaca elevada. Considere diminuir um pouco o ritmo.';
      feedbackType = 'heart_rate';
    } else if (progress.heartRate < 120) { // Low HR threshold
      analysis.heartRateAnalysis = 'low';
      if (goal.type !== 'free_run') {
        feedbackMessage += ' Você pode aumentar ligeiramente a intensidade.';
      }
    }
  }

  // Default motivational message if no specific feedback
  if (!feedbackMessage) {
    const motivationalMessages = [
      'Continue assim! Você está indo muito bem!',
      'Mantenha o foco e a determinação!',
      'Cada passo te leva mais perto do objetivo!',
      'Excelente performance! Continue!',
      'Respiração constante e passada firme!'
    ];
    feedbackMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
    feedbackType = 'motivation';
  }

  return {
    message: feedbackMessage,
    type: feedbackType,
    analysis,
    strategyUpdate
  };
}

async function updateAIPrescription(
  sessionId: string, 
  goal: TrainingGoal, 
  progress: SessionProgress,
  strategyUpdate: any
) {
  try {
    // Check if prescription already exists
    const { data: existingPrescription } = await supabase
      .from('ai_prescriptions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    const prescriptionData = {
      session_id: sessionId,
      planned_strategy: goal,
      actual_performance: {
        currentDistance: progress.distance,
        currentDuration: progress.duration,
        currentPace: progress.pace,
        currentHeartRate: progress.heartRate
      },
      adjustments_made: strategyUpdate,
      goal_feasibility_score: calculateFeasibilityScore(goal, progress),
      recommended_pace_min_km: calculateRecommendedPace(goal, progress),
      recommended_heart_rate_zone: calculateRecommendedHRZone(progress.heartRate)
    };

    if (existingPrescription) {
      // Update existing prescription
      await supabase
        .from('ai_prescriptions')
        .update(prescriptionData)
        .eq('session_id', sessionId);
    } else {
      // Create new prescription
      await supabase
        .from('ai_prescriptions')
        .insert(prescriptionData);
    }
  } catch (error) {
    console.error('Error updating AI prescription:', error);
  }
}

function calculateFeasibilityScore(goal: TrainingGoal, progress: SessionProgress): number {
  // Simple feasibility calculation based on current performance
  // Returns a score between 0 and 1
  
  switch (goal.type) {
    case 'target_pace':
      if (goal.targetPace && progress.pace > 0) {
        const deviation = Math.abs(progress.pace - goal.targetPace) / goal.targetPace;
        return Math.max(0, 1 - deviation);
      }
      break;
      
    case 'target_distance':
      if (goal.targetDistance && progress.distance > 0) {
        // Estimate based on current pace if we have duration
        if (progress.duration > 0) {
          const estimatedTotalTime = (goal.targetDistance / progress.distance) * progress.duration;
          const feasible = estimatedTotalTime < 7200; // Less than 2 hours
          return feasible ? 0.8 : 0.4;
        }
      }
      break;
  }
  
  return 0.7; // Default moderate feasibility
}

function calculateRecommendedPace(goal: TrainingGoal, progress: SessionProgress): number | null {
  if (goal.type === 'target_pace' && goal.targetPace) {
    return goal.targetPace;
  }
  
  if (progress.pace > 0) {
    // Suggest a sustainable pace based on current performance
    return progress.pace * 1.05; // Slightly easier pace
  }
  
  return null;
}

function calculateRecommendedHRZone(currentHR: number): string {
  if (currentHR <= 0) return 'unknown';
  
  if (currentHR < 120) return 'Zone 1 (Recovery)';
  if (currentHR < 140) return 'Zone 2 (Base)';
  if (currentHR < 160) return 'Zone 3 (Aerobic)';
  if (currentHR < 180) return 'Zone 4 (Threshold)';
  return 'Zone 5 (VO2 Max)';
}