import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { raceId } = await req.json();

    // Get race details
    const { data: race, error: raceError } = await supabase
      .from('user_target_races')
      .select('*')
      .eq('id', raceId)
      .eq('user_id', user.id)
      .single();

    if (raceError || !race) {
      return new Response(JSON.stringify({ error: 'Race not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's recent activities for analysis
    const { data: activities } = await supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('activity_date', { ascending: false })
      .limit(50);

    // Calculate current fitness metrics
    const runningActivities = activities?.filter(a => 
      a.activity_type?.toLowerCase().includes('run')) || [];

    if (runningActivities.length === 0) {
      return new Response(JSON.stringify({
        error: 'Insufficient running data for analysis',
        estimated_time_minutes: null,
        readiness_score: 0,
        fitness_level: 'beginner'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate metrics
    const avgPace = runningActivities
      .filter(a => a.pace_min_per_km)
      .reduce((sum, a) => sum + a.pace_min_per_km, 0) / 
      runningActivities.filter(a => a.pace_min_per_km).length;

    const avgDistance = runningActivities
      .reduce((sum, a) => sum + (a.total_distance_meters || 0), 0) / 
      runningActivities.length / 1000; // Convert to km

    const totalWeeklyDistance = runningActivities
      .filter(a => new Date(a.activity_date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .reduce((sum, a) => sum + (a.total_distance_meters || 0), 0) / 1000;

    // Estimate race time using Riegel formula
    const longestRun = Math.max(...runningActivities.map(a => (a.total_distance_meters || 0) / 1000));
    const raceDistanceKm = race.distance_meters / 1000;
    
    // Use Riegel formula: T2 = T1 * (D2/D1)^1.06
    const estimatedTimeMinutes = longestRun > 0 ? 
      (longestRun * avgPace) * Math.pow(raceDistanceKm / longestRun, 1.06) : 
      avgPace * raceDistanceKm * 1.1; // Add 10% safety margin

    // Determine fitness level and readiness
    let fitnessLevel = 'beginner';
    let readinessScore = 0;

    if (totalWeeklyDistance >= 40 && avgPace <= 5.5) {
      fitnessLevel = 'elite';
      readinessScore = 85;
    } else if (totalWeeklyDistance >= 25 && avgPace <= 6.5) {
      fitnessLevel = 'advanced';
      readinessScore = 70;
    } else if (totalWeeklyDistance >= 15 && avgPace <= 7.5) {
      fitnessLevel = 'intermediate';
      readinessScore = 55;
    } else {
      fitnessLevel = 'beginner';
      readinessScore = 30;
    }

    // Calculate gap analysis
    const targetTimeMinutes = race.target_time_minutes || estimatedTimeMinutes;
    const timeGapMinutes = estimatedTimeMinutes - targetTimeMinutes;
    const timeGapPercentage = (timeGapMinutes / targetTimeMinutes) * 100;

    // Generate AI-powered improvement suggestions
    const prompt = `
    As a professional running coach, analyze this runner's performance data and provide specific improvement suggestions:

    Race Goal: ${race.race_name} - ${raceDistanceKm}km in ${Math.floor(targetTimeMinutes / 60)}:${(targetTimeMinutes % 60).toString().padStart(2, '0')}
    Current Estimated Time: ${Math.floor(estimatedTimeMinutes / 60)}:${(estimatedTimeMinutes % 60).toString().padStart(2, '0')}
    Time Gap: ${timeGapMinutes > 0 ? '+' : ''}${timeGapMinutes.toFixed(1)} minutes (${timeGapPercentage.toFixed(1)}%)
    
    Current Training:
    - Weekly Distance: ${totalWeeklyDistance.toFixed(1)}km
    - Average Pace: ${avgPace.toFixed(1)} min/km
    - Longest Recent Run: ${longestRun.toFixed(1)}km
    - Fitness Level: ${fitnessLevel}
    
    Days until race: ${Math.ceil((new Date(race.race_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}

    Provide 3-5 specific, actionable training recommendations in Portuguese. Focus on:
    1. Key training areas (speed, endurance, strength)
    2. Specific workout types
    3. Weekly structure suggestions
    4. Realistic timeline expectations

    Respond in JSON format:
    {
      "suggestions": [
        {
          "area": "string",
          "recommendation": "string",
          "priority": "high|medium|low"
        }
      ],
      "focus_areas": ["string array"],
      "realistic_target": "string with achievable goal"
    }
    `;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional running coach providing detailed training analysis.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const aiData = await aiResponse.json();
    let aiSuggestions = null;

    try {
      aiSuggestions = JSON.parse(aiData.choices[0].message.content);
    } catch (error) {
      console.log('Failed to parse AI response, using fallback');
    }

    // Fallback suggestions if AI fails
    const fallbackSuggestions = {
      suggestions: [
        {
          area: "Resistência",
          recommendation: timeGapMinutes > 5 ? 
            "Aumentar volume semanal gradualmente. Adicionar 1-2 corridas longas por semana." :
            "Manter volume atual e focar na consistência dos treinos.",
          priority: "high"
        },
        {
          area: "Velocidade",
          recommendation: "Incluir treinos intervalados semanais (4x1km ou 8x400m) para melhorar o pace.",
          priority: "medium"
        }
      ],
      focus_areas: timeGapMinutes > 0 ? ["Resistência", "Pace"] : ["Manutenção", "Tapering"],
      realistic_target: timeGapMinutes > 10 ? 
        "Com 8-12 semanas de treinamento consistente, é possível reduzir 3-5 minutos do tempo atual." :
        "Meta atual é realista. Focar na execução da estratégia de prova."
    };

    const finalSuggestions = aiSuggestions || fallbackSuggestions;

    // Save snapshot to database
    await supabase
      .from('race_progress_snapshots')
      .insert({
        race_id: raceId,
        user_id: user.id,
        estimated_time_minutes: Math.round(estimatedTimeMinutes),
        fitness_level: fitnessLevel,
        readiness_score: readinessScore,
        gap_analysis: {
          target_time_minutes: targetTimeMinutes,
          estimated_time_minutes: Math.round(estimatedTimeMinutes),
          gap_minutes: timeGapMinutes,
          gap_percentage: timeGapPercentage,
          distance_km: raceDistanceKm
        },
        improvement_suggestions: finalSuggestions.suggestions,
        training_focus_areas: finalSuggestions.focus_areas
      });

    return new Response(JSON.stringify({
      estimated_time_minutes: Math.round(estimatedTimeMinutes),
      fitness_level: fitnessLevel,
      readiness_score: readinessScore,
      gap_analysis: {
        target_time_minutes: targetTimeMinutes,
        gap_minutes: timeGapMinutes,
        gap_percentage: timeGapPercentage
      },
      suggestions: finalSuggestions.suggestions,
      focus_areas: finalSuggestions.focus_areas,
      realistic_target: finalSuggestions.realistic_target
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error analyzing race readiness:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});