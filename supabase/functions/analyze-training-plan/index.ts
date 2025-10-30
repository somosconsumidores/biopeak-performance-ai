import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId } = await req.json();
    console.log('🎯 Analyzing training plan:', planId);

    if (!planId) {
      throw new Error('Plan ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch training plan
    const { data: plan, error: planError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      throw new Error('Training plan not found');
    }

    // Fetch completed workouts
    const { data: workouts, error: workoutsError } = await supabase
      .from('training_workouts')
      .select('*')
      .eq('plan_id', planId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: true });

    if (workoutsError) {
      throw new Error('Failed to fetch workouts');
    }

    console.log(`📊 Found ${workouts?.length || 0} completed workouts`);

    // Check if there are enough workouts to analyze
    if (!workouts || workouts.length < 3) {
      return new Response(
        JSON.stringify({
          analysis: null,
          message: 'Você precisa concluir pelo menos 3 treinos para ter uma análise significativa do seu progresso.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare context for AI
    const workoutsSummary = workouts.map(w => ({
      type: w.type,
      title: w.title,
      date: w.scheduled_date,
      completed_date: w.completed_at,
      distance: w.distance_km,
      duration: w.duration_minutes,
      description: w.description
    }));

    const prompt = `Analise o progresso deste atleta no plano de treino:

**Plano de Treino:**
- Objetivo: ${plan.goal_race_distance}
- Data da Prova: ${plan.target_race_date}
- Duração do Plano: ${plan.duration_weeks} semanas
- Nível do Atleta: ${plan.experience_level}

**Treinos Concluídos (${workouts.length}):**
${JSON.stringify(workoutsSummary, null, 2)}

Por favor, forneça uma análise detalhada e motivadora sobre:

1. **Progresso Geral**: Como está a evolução do atleta? Está seguindo bem o plano?

2. **Pontos Fortes**: O que o atleta está fazendo bem? Quais aspectos merecem destaque?

3. **Áreas de Atenção**: Existem padrões preocupantes ou aspectos que precisam de atenção?

4. **Impacto no Objetivo**: Como esse progresso se relaciona com o objetivo final (${plan.goal_race_distance} na data ${plan.target_race_date})?

5. **Recomendações**: O que o atleta deve focar nos próximos treinos?

Mantenha o tom positivo, motivador e específico para corrida. Use dados concretos dos treinos quando possível.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🤖 Calling AI for analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um coach de corrida experiente e motivador. Analise dados de treino e forneça feedback construtivo e encorajador.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to generate analysis');
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0].message.content;

    console.log('✅ Analysis generated successfully');

    return new Response(
      JSON.stringify({
        analysis: analysisText,
        completedWorkouts: workouts.length,
        totalWorkouts: plan.total_workouts || workouts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-training-plan:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to analyze training plan' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
