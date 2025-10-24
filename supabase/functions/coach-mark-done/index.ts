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

    const { user_id, plan_id, workout_date } = await req.json();

    if (!user_id || !plan_id || !workout_date) {
      return new Response(
        JSON.stringify({ error: 'user_id, plan_id, and workout_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🏃 Marking workout as done for user ${user_id}, plan ${plan_id}, date ${workout_date}`);

    // Validate plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select('id, user_id')
      .eq('id', plan_id)
      .eq('user_id', user_id)
      .single();

    if (planError || !plan) {
      console.error('❌ Plan not found or unauthorized');
      return new Response(
        JSON.stringify({ error: 'Plan not found or unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find workout for the date (today or yesterday)
    let workout = null;
    let { data: todayWorkout } = await supabase
      .from('training_plan_workouts')
      .select('id, title, workout_date, status')
      .eq('plan_id', plan_id)
      .eq('user_id', user_id)
      .eq('workout_date', workout_date)
      .single();

    if (todayWorkout) {
      workout = todayWorkout;
    } else {
      // Try yesterday (in case user completed late)
      const yesterday = new Date(workout_date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayWorkout } = await supabase
        .from('training_plan_workouts')
        .select('id, title, workout_date, status')
        .eq('plan_id', plan_id)
        .eq('user_id', user_id)
        .eq('workout_date', yesterdayStr)
        .single();

      workout = yesterdayWorkout;
    }

    if (!workout) {
      console.warn('⚠️ No workout found for today or yesterday');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nenhum treino encontrado para hoje ou ontem' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as completed
    const { error: updateError } = await supabase
      .from('training_plan_workouts')
      .update({ 
        status: 'completed', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', workout.id);

    if (updateError) {
      console.error('❌ Failed to update workout:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update workout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event
    await supabase
      .from('coach_events')
      .insert({
        user_id,
        plan_id,
        event_type: 'done_marked',
        payload: {
          workout_id: workout.id,
          workout_date: workout.workout_date,
          title: workout.title,
        },
      });

    console.log(`✅ Workout marked as done: ${workout.title}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Treino marcado como concluído',
        workout: {
          id: workout.id,
          title: workout.title,
          workout_date: workout.workout_date,
          status: 'completed',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in coach-mark-done:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
