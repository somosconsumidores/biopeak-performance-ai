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

    // Calculate baselines and estimates aligned with training plan logic
    const riegel = (t1: number, d1: number, d2: number, exp = 1.06) => t1 * Math.pow(d2 / d1, exp);

    const validRuns = (runningActivities || []).filter((r: any) => {
      const pace = Number(r.pace_min_per_km);
      const distKm = Number(r.total_distance_meters || 0) / 1000;
      const durMin = Number(r.total_time_minutes || 0);
      const date = r.activity_date ? new Date(r.activity_date) : null;
      return Number.isFinite(pace) && pace > 3 && pace < 12 &&
             Number.isFinite(distKm) && distKm >= 2 &&
             Number.isFinite(durMin) && durMin >= 10 &&
             date !== null;
    });

    if (validRuns.length === 0) {
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

    // Baseline paces
    const paces = validRuns.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
    const pace_best = paces[0];
    const pace_median = paces[Math.floor(paces.length / 2)];

    // Target distance
    const raceDistanceKm = (race.distance_meters || 0) / 1000;

    // Use median 5k base and Riegel to derive target paces, then time
    const base5kTimeMin = pace_median * 5;
    const pace_10k = riegel(base5kTimeMin, 5, 10) / 10;
    const pace_21k = riegel(base5kTimeMin, 5, 21.097) / 21.097;
    const pace_42k = riegel(base5kTimeMin, 5, 42.195) / 42.195;

    let estimatedTimeMinutes = 0;
    if (raceDistanceKm >= 41) {
      estimatedTimeMinutes = pace_42k * 42.195;
    } else if (raceDistanceKm >= 20) {
      estimatedTimeMinutes = pace_21k * 21.097;
    } else if (raceDistanceKm >= 9) {
      estimatedTimeMinutes = pace_10k * 10;
    } else {
      // For shorter distances, scale from median pace directly
      estimatedTimeMinutes = pace_median * raceDistanceKm;
    }

    // Weekly patterns for last 8 weeks
    const weekKey = (d: Date) => {
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = dt.getUTCDay() || 7; // 1..7, Monday=1
      dt.setUTCDate(dt.getUTCDate() - (day - 1));
      return dt.toISOString().slice(0, 10);
    };

    const now = new Date();
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const byWeek = new Map<string, { count: number; distanceKm: number }>();
    validRuns.forEach((r: any) => {
      const d = new Date(r.activity_date);
      if (d < cutoff) return;
      const key = weekKey(d);
      const prev = byWeek.get(key) || { count: 0, distanceKm: 0 };
      byWeek.set(key, {
        count: prev.count + 1,
        distanceKm: prev.distanceKm + Number(r.total_distance_meters || 0) / 1000,
      });
    });
    const lastWeeks = Array.from(byWeek.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 8)
      .map(([, v]) => v);

    const avgWeeklyFrequency = lastWeeks.length ? lastWeeks.reduce((s, v) => s + v.count, 0) / lastWeeks.length : 0;
    const avgWeeklyDistanceKm = lastWeeks.length ? lastWeeks.reduce((s, v) => s + v.distanceKm, 0) / lastWeeks.length : 0;

    // Fitness level classification aligned with useAthleteAnalysis fallback
    let fitnessLevel = 'beginner';
    const fiveKsec = base5kTimeMin * 60;
    if (avgWeeklyDistanceKm >= 70 || fiveKsec < 18 * 60) {
      fitnessLevel = 'elite';
    } else if (avgWeeklyDistanceKm >= 40 || avgWeeklyFrequency >= 4 || fiveKsec < 22 * 60) {
      fitnessLevel = 'advanced';
    } else if (avgWeeklyDistanceKm >= 15 || avgWeeklyFrequency >= 3) {
      fitnessLevel = 'intermediate';
    } else {
      fitnessLevel = 'beginner';
    }

    // Readiness score (simple, transparent)
    const weeklyVolumeScore = Math.min((avgWeeklyDistanceKm / 30) * 50, 50);
    const freqScore = Math.min((avgWeeklyFrequency / 5) * 30, 30);
    const paceScore = pace_median <= 4.5 ? 20 : pace_median <= 5.5 ? 15 : pace_median <= 6.5 ? 10 : pace_median <= 7.5 ? 5 : 0;
    const readinessScore = Math.round(Math.min(weeklyVolumeScore + freqScore + paceScore, 100));

    console.log('Race readiness baselines', {
      pace_best, pace_median, pace_10k, pace_21k, pace_42k, avgWeeklyFrequency, avgWeeklyDistanceKm, fitnessLevel, estimatedTimeMinutes
    });

    // Calculate gap analysis
    const targetTimeMinutes = race.target_time_minutes || estimatedTimeMinutes;
    const timeGapMinutes = estimatedTimeMinutes - targetTimeMinutes;
    const timeGapPercentage = (timeGapMinutes / targetTimeMinutes) * 100;

    // Generate AI-powered improvement suggestions
    const longestRunKm = Math.max(...validRuns.map((r: any) => Number(r.total_distance_meters || 0) / 1000));
    const prompt = `
    As a professional running coach, analyze this runner's performance data and provide specific improvement suggestions:

    Race Goal: ${race.race_name} - ${raceDistanceKm}km in ${Math.floor(targetTimeMinutes / 60)}:${(targetTimeMinutes % 60).toString().padStart(2, '0')}
    Current Estimated Time: ${Math.floor(estimatedTimeMinutes / 60)}:${(estimatedTimeMinutes % 60).toString().padStart(2, '0')}
    Time Gap: ${timeGapMinutes > 0 ? '+' : ''}${timeGapMinutes.toFixed(1)} minutes (${timeGapPercentage.toFixed(1)}%)
    
    Current Training:
    - Weekly Distance (avg last weeks): ${avgWeeklyDistanceKm.toFixed(1)}km
    - Weekly Frequency (avg): ${avgWeeklyFrequency.toFixed(1)} sessions
    - Median Pace: ${pace_median.toFixed(2)} min/km
    - Longest Recent Run: ${Number.isFinite(longestRunKm) ? longestRunKm.toFixed(1) : 'N/A'}km
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
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: 'You are a professional running coach providing detailed training analysis. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 600,
        response_format: { type: 'json_object' }
      }),
    });

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData, null, 2));
    
    let aiSuggestions: any = null;

    // Helper to safely extract content
    const getContent = (d: any) => d?.choices?.[0]?.message?.content;

    let content = getContent(aiData);

    if (typeof content === 'string' && content.trim().length > 0) {
      try {
        aiSuggestions = JSON.parse(content);
      } catch (err) {
        console.error('Failed to parse AI JSON:', err, 'Content:', content);
      }
    } else {
      console.warn('AI response content empty on first attempt. Retrying with compact prompt...');
      const retryResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'You are a professional running coach providing detailed training analysis. Always respond with valid JSON only.' },
            { role: 'user', content: prompt + '\nResponda apenas com JSON. Sem texto extra.' }
          ],
          max_completion_tokens: 400,
          response_format: { type: 'json_object' }
        }),
      });
      const retryData = await retryResp.json();
      console.log('AI Retry Response:', JSON.stringify(retryData, null, 2));
      content = getContent(retryData);
      if (typeof content === 'string' && content.trim().length > 0) {
        try {
          aiSuggestions = JSON.parse(content);
        } catch (err) {
          console.error('Failed to parse AI JSON on retry:', err, 'Content:', content);
        }
      }
    }

    // If still no AI suggestions, return error (no fallback)
    if (!aiSuggestions || !Array.isArray(aiSuggestions.suggestions)) {
      return new Response(JSON.stringify({ error: 'AI_suggestions_unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }


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
        improvement_suggestions: aiSuggestions.suggestions,
        training_focus_areas: aiSuggestions.focus_areas
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
      suggestions: aiSuggestions.suggestions,
      focus_areas: aiSuggestions.focus_areas,
      realistic_target: aiSuggestions.realistic_target
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