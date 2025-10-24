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

    const { user_id, plan_id, from_date, to_date, strategy = 'replace' } = await req.json();

    if (!user_id || !plan_id || !from_date || !to_date) {
      return new Response(
        JSON.stringify({ error: 'user_id, plan_id, from_date, and to_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📅 Rescheduling workout from ${from_date} to ${to_date} (strategy: ${strategy})`);

    // Validate plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select('id, user_id, start_date, end_date')
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

    // Validate to_date is within plan range
    if (to_date < plan.start_date || to_date > plan.end_date) {
      return new Response(
        JSON.stringify({ error: 'to_date must be within plan date range' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find workout to move
    const { data: workoutToMove, error: fromError } = await supabase
      .from('training_plan_workouts')
      .select('id, title, description, workout_type, target_pace_min_km, distance_meters, duration_minutes')
      .eq('plan_id', plan_id)
      .eq('user_id', user_id)
      .eq('workout_date', from_date)
      .single();

    if (fromError || !workoutToMove) {
      console.warn('⚠️ No workout found on from_date');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nenhum treino encontrado na data de origem' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's already a workout on to_date
    const { data: existingWorkout } = await supabase
      .from('training_plan_workouts')
      .select('id, title, workout_date')
      .eq('plan_id', plan_id)
      .eq('user_id', user_id)
      .eq('workout_date', to_date)
      .single();

    let conflicts = [];

    if (existingWorkout) {
      if (strategy === 'replace') {
        // Delete existing workout
        await supabase
          .from('training_plan_workouts')
          .delete()
          .eq('id', existingWorkout.id);
        
        conflicts.push({
          id: existingWorkout.id,
          title: existingWorkout.title,
          date: existingWorkout.workout_date,
          action: 'replaced',
        });

      } else if (strategy === 'swap') {
        // Swap dates
        await supabase
          .from('training_plan_workouts')
          .update({ workout_date: from_date, status: 'planned', updated_at: new Date().toISOString() })
          .eq('id', existingWorkout.id);

        conflicts.push({
          id: existingWorkout.id,
          title: existingWorkout.title,
          date: from_date,
          action: 'swapped',
        });

      } else if (strategy === 'push') {
        // Push existing workout to next day
        const nextDay = new Date(to_date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        await supabase
          .from('training_plan_workouts')
          .update({ workout_date: nextDayStr, status: 'planned', updated_at: new Date().toISOString() })
          .eq('id', existingWorkout.id);

        conflicts.push({
          id: existingWorkout.id,
          title: existingWorkout.title,
          date: nextDayStr,
          action: 'pushed',
        });
      }
    }

    // Move the workout
    const { error: updateError } = await supabase
      .from('training_plan_workouts')
      .update({ 
        workout_date: to_date, 
        status: 'planned',
        updated_at: new Date().toISOString() 
      })
      .eq('id', workoutToMove.id);

    if (updateError) {
      console.error('❌ Failed to reschedule workout:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reschedule workout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event
    await supabase
      .from('coach_events')
      .insert({
        user_id,
        plan_id,
        event_type: 'reschedule',
        payload: {
          workout_id: workoutToMove.id,
          from_date,
          to_date,
          title: workoutToMove.title,
          strategy,
          conflicts,
        },
      });

    console.log(`✅ Workout rescheduled: ${workoutToMove.title} from ${from_date} to ${to_date}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Treino reagendado com sucesso',
        moved_workout: {
          id: workoutToMove.id,
          title: workoutToMove.title,
          old_date: from_date,
          new_date: to_date,
        },
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in coach-reschedule:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
