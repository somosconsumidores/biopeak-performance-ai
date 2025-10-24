import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-coach-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate coach key
    const COACH_KEY = Deno.env.get('COACH_EDGE_KEY');
    const authHeader = req.headers.get('x-coach-key');
    
    if (!authHeader || authHeader !== COACH_KEY) {
      console.error('❌ Unauthorized: Invalid or missing x-coach-key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { plan_id, user_id: expected_user_id } = await req.json();

    if (!plan_id) {
      return new Response(
        JSON.stringify({ error: 'plan_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🤖 Fetching context for plan_id: ${plan_id}`);

    // 1) Fetch training plan
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select('id, user_id, plan_name, goal_type, start_date, end_date, weeks, status, target_event_date, goal_target_time_minutes')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      console.error('❌ Plan not found:', planError);
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user_id if provided
    if (expected_user_id && plan.user_id !== expected_user_id) {
      console.error('❌ User mismatch');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: user_id mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Fetch training plan preferences
    const { data: prefs } = await supabase
      .from('training_plan_preferences')
      .select('days_per_week, days_of_week, long_run_weekday')
      .eq('plan_id', plan_id)
      .single();

    // 3) Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, phone, gender')
      .eq('user_id', plan.user_id)
      .single();

    // 4) Fetch upcoming workouts (next 60-90 days, status = 'planned')
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { data: workouts } = await supabase
      .from('training_plan_workouts')
      .select('id, workout_date, title, description, workout_type, target_pace_min_km, distance_meters, duration_minutes, status')
      .eq('plan_id', plan_id)
      .eq('user_id', plan.user_id)
      .gte('workout_date', today)
      .lte('workout_date', futureDateStr)
      .order('workout_date', { ascending: true });

    // 5) Calculate stats
    const totalWorkouts = workouts?.length || 0;
    const completedCount = workouts?.filter((w: any) => w.status === 'completed').length || 0;
    const upcomingCount = workouts?.filter((w: any) => w.status === 'planned').length || 0;
    const nextWorkout = workouts?.find((w: any) => w.status === 'planned');

    const response = {
      user_id: plan.user_id,
      display_name: profile?.display_name || null,
      plan: {
        id: plan.id,
        plan_name: plan.plan_name,
        goal_type: plan.goal_type,
        start_date: plan.start_date,
        end_date: plan.end_date,
        weeks: plan.weeks,
        status: plan.status,
        target_event_date: plan.target_event_date,
        goal_target_time_minutes: plan.goal_target_time_minutes,
      },
      prefs: prefs || {},
      profile: profile || {},
      workouts: workouts || [],
      stats: {
        total_workouts: totalWorkouts,
        completed_count: completedCount,
        upcoming_count: upcomingCount,
        next_workout_date: nextWorkout?.workout_date || null,
      },
    };

    console.log(`✅ Context fetched successfully: ${totalWorkouts} workouts, next: ${nextWorkout?.workout_date || 'none'}`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in coach-get-context:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
