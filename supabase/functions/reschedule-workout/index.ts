import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`🔄 Reschedule workout request from user: ${userId}`);

    // Parse request body
    const { workout_id, new_date, strategy = 'swap' } = await req.json();

    if (!workout_id || !new_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: workout_id and new_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate strategy
    const validStrategies = ['swap', 'replace', 'push'];
    if (!validStrategies.includes(strategy)) {
      return new Response(
        JSON.stringify({ error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📅 Moving workout ${workout_id} to ${new_date} with strategy: ${strategy}`);

    // Fetch the workout to be moved
    const { data: workoutToMove, error: workoutError } = await supabase
      .from('training_plan_workouts')
      .select('*, training_plans!inner(id, start_date, end_date, user_id)')
      .eq('id', workout_id)
      .single();

    if (workoutError || !workoutToMove) {
      console.error('Workout fetch error:', workoutError);
      return new Response(
        JSON.stringify({ error: 'Workout not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (workoutToMove.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: workout does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = workoutToMove.training_plans;
    const planId = plan.id;
    const fromDate = workoutToMove.workout_date;

    // Validate new_date is within plan range
    if (new_date < plan.start_date || new_date > plan.end_date) {
      return new Response(
        JSON.stringify({ 
          error: 'New date must be within the training plan period',
          plan_start: plan.start_date,
          plan_end: plan.end_date
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing workout on the target date
    const { data: existingWorkouts, error: existingError } = await supabase
      .from('training_plan_workouts')
      .select('*')
      .eq('plan_id', planId)
      .eq('workout_date', new_date)
      .neq('id', workout_id);

    if (existingError) {
      console.error('Error checking existing workouts:', existingError);
      throw existingError;
    }

    const existingWorkout = existingWorkouts && existingWorkouts.length > 0 ? existingWorkouts[0] : null;

    // Apply conflict resolution strategy
    if (existingWorkout) {
      console.log(`⚠️ Conflict detected: workout ${existingWorkout.id} exists on ${new_date}`);
      
      if (strategy === 'replace') {
        // Delete the existing workout
        const { error: deleteError } = await supabase
          .from('training_plan_workouts')
          .delete()
          .eq('id', existingWorkout.id);

        if (deleteError) {
          console.error('Error deleting existing workout:', deleteError);
          throw deleteError;
        }
        console.log(`🗑️ Replaced (deleted) existing workout ${existingWorkout.id}`);
      } 
      else if (strategy === 'swap') {
        // Swap dates between the two workouts
        const { error: swapError } = await supabase
          .from('training_plan_workouts')
          .update({ workout_date: fromDate, updated_at: new Date().toISOString() })
          .eq('id', existingWorkout.id);

        if (swapError) {
          console.error('Error swapping workout:', swapError);
          throw swapError;
        }
        console.log(`🔄 Swapped workout ${existingWorkout.id} to ${fromDate}`);
      } 
      else if (strategy === 'push') {
        // Push the existing workout to the next day
        const nextDay = new Date(new_date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const { error: pushError } = await supabase
          .from('training_plan_workouts')
          .update({ workout_date: nextDayStr, updated_at: new Date().toISOString() })
          .eq('id', existingWorkout.id);

        if (pushError) {
          console.error('Error pushing workout:', pushError);
          throw pushError;
        }
        console.log(`➡️ Pushed workout ${existingWorkout.id} to ${nextDayStr}`);
      }
    }

    // Move the original workout to the new date
    const { data: updatedWorkout, error: updateError } = await supabase
      .from('training_plan_workouts')
      .update({ 
        workout_date: new_date, 
        status: 'planned',
        updated_at: new Date().toISOString() 
      })
      .eq('id', workout_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating workout date:', updateError);
      throw updateError;
    }

    console.log(`✅ Successfully moved workout ${workout_id} from ${fromDate} to ${new_date}`);

    // Log event to coach_events
    await supabase
      .from('coach_events')
      .insert({
        user_id: userId,
        plan_id: planId,
        event_type: 'workout_rescheduled',
        payload: {
          workout_id,
          from_date: fromDate,
          to_date: new_date,
          strategy,
          had_conflict: !!existingWorkout
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        workout: updatedWorkout,
        message: `Treino reagendado de ${fromDate} para ${new_date}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in reschedule-workout:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
