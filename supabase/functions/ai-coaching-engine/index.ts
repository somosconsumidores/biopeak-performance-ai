import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

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
  const currentKm = Math.floor(distanceKm);
  
  // Format time as MM:SS
  const minutes = Math.floor(progress.duration / 60);
  const seconds = Math.floor(progress.duration % 60);
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Garmin Connect style feedback: every 1km completed
  // Report: Distance, Time, Pace
  let feedbackMessage = `${currentKm} quilômetro${currentKm > 1 ? 's' : ''}. Tempo: ${timeFormatted}. Pace: ${progress.pace.toFixed(1)} minutos por quilômetro.`;
  
  let feedbackType: 'pace_adjustment' | 'motivation' | 'goal_progress' | 'heart_rate' | 'strategy_change' = 'goal_progress';
  
  // Calculate deviations from target
  let analysis = {
    paceDeviation: 0,
    distanceProgress: 0,
    timeProgress: 0,
    heartRateAnalysis: 'normal'
  };

  // Optional: Add goal-specific context
  if (goal.type === 'target_pace' && goal.targetPace) {
    analysis.paceDeviation = progress.pace - goal.targetPace;
    if (Math.abs(analysis.paceDeviation) > 0.5) {
      if (analysis.paceDeviation > 0) {
        feedbackMessage += ` Você está um pouco abaixo do pace objetivo.`;
      } else {
        feedbackMessage += ` Você está acima do pace objetivo.`;
      }
    }
  }

  if (goal.type === 'target_distance' && goal.targetDistance) {
    analysis.distanceProgress = (progress.distance / goal.targetDistance) * 100;
    const remainingKm = (goal.targetDistance - progress.distance) / 1000;
    if (remainingKm > 0) {
      feedbackMessage += ` Restam ${remainingKm.toFixed(1)} quilômetros.`;
    }
  }

  return {
    message: feedbackMessage,
    type: feedbackType,
    analysis,
    strategyUpdate: null
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