import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { message, conversationHistory = [], trainingPlanContext } = await req.json();

    console.log('🤖 AI Coach Chat: Processing message for user:', user.id, 'hasTrainingPlan:', !!trainingPlanContext);

    // Fetch user's active training plan if not provided in context
    let planContext = trainingPlanContext;
    if (!planContext) {
      const { data: activePlan } = await supabase
        .from('training_plans')
        .select(`
          *,
          training_plan_workouts (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (activePlan) {
        const workouts = activePlan.training_plan_workouts || [];
        planContext = {
          plan: {
            name: activePlan.plan_name,
            goal: activePlan.goal_type,
            weeks: activePlan.weeks,
            startDate: activePlan.start_date,
            endDate: activePlan.end_date,
            targetEventDate: activePlan.target_event_date
          },
          workouts: workouts.map((w: any) => ({
            week: w.week_number,
            day: w.day_of_week,
            type: w.workout_type,
            name: w.workout_name,
            description: w.description,
            completed: w.is_completed,
            scheduledDate: w.scheduled_date
          })),
          progress: {
            totalWorkouts: workouts.length,
            completedWorkouts: workouts.filter((w: any) => w.is_completed).length,
            completionRate: workouts.length > 0 ? (workouts.filter((w: any) => w.is_completed).length / workouts.length) * 100 : 0
          }
        };
      }
    }
    const { data: activities, error: activitiesError } = await supabase
      .from('all_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('activity_date', { ascending: false })
      .limit(50);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    }

    // Fetch user's recent VO2max data
    const { data: vo2maxData, error: vo2Error } = await supabase
      .from('garmin_tokens')
      .select('garmin_user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    let recentVo2Max = null;
    if (vo2maxData && !vo2Error) {
      const { data: vo2Records } = await supabase
        .from('garmin_vo2max')
        .select('*')
        .eq('garmin_user_id', vo2maxData.garmin_user_id)
        .order('calendar_date', { ascending: false })
        .limit(5);
      recentVo2Max = vo2Records;
    }

    // Fetch user profile for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, created_at')
      .eq('user_id', user.id)
      .single();

    // Calculate activity summary for context
    const activitySummary = activities ? {
      totalActivities: activities.length,
      totalDistance: activities.reduce((sum, act) => sum + (act.total_distance_meters || 0), 0),
      totalTime: activities.reduce((sum, act) => sum + (act.total_time_minutes || 0), 0),
      averagePace: activities
        .filter(act => act.pace_min_per_km && act.activity_type?.toLowerCase().includes('run'))
        .reduce((sum, act, _, arr) => sum + (act.pace_min_per_km / arr.length), 0),
      lastActivity: activities[0]?.activity_date,
      mostCommonType: activities.length > 0 ? 
        activities.reduce((acc, act) => {
          acc[act.activity_type] = (acc[act.activity_type] || 0) + 1;
          return acc;
        }, {})[Object.keys(activities.reduce((acc, act) => {
          acc[act.activity_type] = (acc[act.activity_type] || 0) + 1;
          return acc;
        }, {})).reduce((a, b) => activities.reduce((acc, act) => {
          acc[act.activity_type] = (acc[act.activity_type] || 0) + 1;
          return acc;
        }, {})[a] > activities.reduce((acc, act) => {
          acc[act.activity_type] = (acc[act.activity_type] || 0) + 1;
          return acc;
        }, {})[b] ? a : b)] : null
    } : null;

    // Create context for AI
    const userContext = `
Usuário: ${profile?.display_name || 'Atleta'}
Membro desde: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'N/A'}

${planContext ? `
PLANO DE TREINO ATIVO:
- Nome: ${planContext.plan.name}
- Objetivo: ${planContext.plan.goal}
- Duração: ${planContext.plan.weeks} semanas
- Período: ${planContext.plan.startDate} até ${planContext.plan.endDate}
${planContext.plan.targetEventDate ? `- Data da Prova: ${planContext.plan.targetEventDate}` : ''}

PROGRESSO DO PLANO:
- Total de treinos: ${planContext.progress.totalWorkouts}
- Treinos completos: ${planContext.progress.completedWorkouts}
- Taxa de conclusão: ${planContext.progress.completionRate.toFixed(1)}%

PRÓXIMOS TREINOS:
${planContext.workouts.filter((w: any) => !w.completed).slice(0, 3).map((w: any) => 
  `- Semana ${w.week}, ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][w.day]}: ${w.name} (${w.type})`
).join('\n')}
` : ''}

Resumo de Atividades (últimas 50):
- Total de atividades: ${activitySummary?.totalActivities || 0}
- Distância total: ${activitySummary?.totalDistance ? (activitySummary.totalDistance / 1000).toFixed(1) + ' km' : 'N/A'}
- Tempo total: ${activitySummary?.totalTime ? (activitySummary.totalTime / 60).toFixed(1) + ' horas' : 'N/A'}
- Pace médio (corrida): ${activitySummary?.averagePace ? activitySummary.averagePace.toFixed(2) + ' min/km' : 'N/A'}
- Última atividade: ${activitySummary?.lastActivity || 'N/A'}
- Tipo mais comum: ${activitySummary?.mostCommonType || 'N/A'}

${recentVo2Max && recentVo2Max.length > 0 ? `
VO2max recente:
- Corrida: ${recentVo2Max[0]?.vo2_max_running || 'N/A'}
- Ciclismo: ${recentVo2Max[0]?.vo2_max_cycling || 'N/A'}
- Data: ${recentVo2Max[0]?.calendar_date || 'N/A'}
` : ''}

Dados disponíveis: ${activities ? 'Sim' : 'Limitados'}
    `;

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `Você é o BioPeak AI Coach, um treinador inteligente especializado em corrida e esportes. 

CONTEXTO DO USUÁRIO:
${userContext}

SUAS RESPONSABILIDADES:
1. Analisar os dados de treino do usuário
2. Fornecer recomendações personalizadas baseadas no histórico
3. Identificar padrões e tendências de performance
4. Sugerir melhorias e ajustes no treino
5. Responder perguntas sobre performance e treino
${planContext ? '6. Dar conselhos específicos sobre o plano de treino ativo\n7. Motivar baseado no progresso do plano\n8. Sugerir ajustes no plano quando necessário' : ''}

REGRAS:
- Sempre use os dados reais do usuário para personalizar respostas
- Seja específico e cite números quando relevante
- Ofereça conselhos práticos e aplicáveis
- Se não tiver dados suficientes, sugira como coletar mais informações
- Mantenha tom motivacional mas realista
- Responda em português brasileiro
- Foque em insights acionáveis

ESPECIALIDADES:
- Análise de pace e consistência
- Interpretação de VO2max
- Planejamento de treinos progressivos
- Prevenção de lesões
- Otimização de performance`
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log('🤖 Calling OpenAI with context for user:', user.id);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: messages,
        max_completion_tokens: 800,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('✅ AI Coach response generated successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      userContext: activitySummary,
      hasTrainingPlan: !!planContext
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-coach-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      details: 'Failed to process AI coach chat request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});