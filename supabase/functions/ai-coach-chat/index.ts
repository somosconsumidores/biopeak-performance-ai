import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// AI Coach Chat - Phase 1: Enhanced context and conversation memory
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to calculate age from birth date
function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Fetch user profile
async function fetchUserProfile(userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

// Fetch recent activities (last N days)
async function fetchRecentActivities(userId: string, supabase: any, days: number = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  const { data, error } = await supabase
    .from('all_activities')
    .select('*')
    .eq('user_id', userId)
    .gte('activity_date', dateThreshold.toISOString().split('T')[0])
    .order('activity_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
  return data || [];
}

// Fetch performance metrics
async function fetchPerformanceMetrics(userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error fetching performance metrics:', error);
    return [];
  }
  return data || [];
}

// Fetch statistics metrics
async function fetchStatisticsMetrics(userId: string, supabase: any, limit: number = 10) {
  const { data, error } = await supabase
    .from('statistics_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching statistics metrics:', error);
    return [];
  }
  return data || [];
}

// Fetch sleep data
async function fetchSleepData(userId: string, supabase: any, days: number) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  const dateStr = dateThreshold.toISOString().split('T')[0];
  
  const { data: garminSleep } = await supabase
    .from('garmin_sleep_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('calendar_date', dateStr)
    .order('calendar_date', { ascending: false });
    
  const sleepRecords = garminSleep || [];
  
  if (sleepRecords.length === 0) {
    return null;
  }
  
  // Calculate averages
  const avgSleepScore = sleepRecords.reduce((sum: number, s: any) => sum + (s.sleep_score || 0), 0) / sleepRecords.length;
  const avgSleepTime = sleepRecords.reduce((sum: number, s: any) => sum + (s.sleep_time_in_seconds || 0), 0) / sleepRecords.length;
  
  return {
    records: sleepRecords.slice(0, 7), // Only include last 7 days in detail
    summary: {
      avgSleepScore: avgSleepScore.toFixed(0),
      avgSleepTimeHours: (avgSleepTime / 3600).toFixed(1),
      daysTracked: sleepRecords.length
    }
  };
}

// Fetch fitness scores
async function fetchFitnessScores(userId: string, supabase: any, days: number) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  const dateStr = dateThreshold.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('fitness_scores_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('calendar_date', dateStr)
    .order('calendar_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching fitness scores:', error);
    return [];
  }
  return data || [];
}

// Fetch variation analysis
async function fetchVariationAnalysis(userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('activity_variation_analysis')
    .select('*')
    .eq('user_id', userId)
    .eq('has_valid_data', true)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching variation analysis:', error);
    return [];
  }
  return data || [];
}

// Fetch user goals/commitments
async function fetchUserGoals(userId: string, supabase: any) {
  const { data, error } = await supabase
    .from('user_commitments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false});
  
  if (error) {
    console.error('Error fetching user goals:', error);
    return [];
  }
  return data || [];
}

// Fetch training plan and workouts
async function fetchTrainingData(userId: string, supabase: any) {
  // Fetch active training plan
  const { data: plan } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  
  if (!plan) return null;
  
  // Fetch workouts
  const { data: workouts } = await supabase
    .from('training_plan_workouts')
    .select('*')
    .eq('training_plan_id', plan.id)
    .order('scheduled_date', { ascending: true });
  
  const completedWorkouts = workouts?.filter((w: any) => w.status === 'completed').length || 0;
  const totalWorkouts = workouts?.length || 0;
  const completionRate = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;
  
  return {
    plan,
    workouts: workouts || [],
    completionRate
  };
}

// Fetch recent insights to avoid repetition
async function fetchRecentInsights(userId: string, supabase: any, days: number) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  const { data, error } = await supabase
    .from('ai_coach_insights_history')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateThreshold.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching insights:', error);
    return [];
  }
  return data || [];
}

// Build intelligent context based on user message
async function buildIntelligentContext(userId: string, userMessage: string, supabase: any) {
  const context: any = {
    profile: null,
    recentActivities: null,
    performance: null,
    statistics: null,
    sleep: null,
    training: null,
    goals: null,
    fitness: null,
    variationAnalysis: null,
    insights: null
  };

  // Always fetch profile and recent activities
  const [profile, recentActivities] = await Promise.all([
    fetchUserProfile(userId, supabase),
    fetchRecentActivities(userId, supabase, 30)
  ]);
  
  context.profile = profile;
  context.recentActivities = recentActivities;

  // Semantic analysis of user message to fetch relevant data
  const messageLower = userMessage.toLowerCase();
  
  const fetchPromises: Promise<void>[] = [];
  
  if (messageLower.includes('sono') || messageLower.includes('dormi') || messageLower.includes('descanso')) {
    fetchPromises.push(
      fetchSleepData(userId, supabase, 14).then(data => { context.sleep = data; })
    );
  }
  
  if (messageLower.includes('pace') || messageLower.includes('ritmo') || messageLower.includes('velocidade') || 
      messageLower.includes('performance') || messageLower.includes('evolução')) {
    fetchPromises.push(
      fetchPerformanceMetrics(userId, supabase).then(data => { context.performance = data; }),
      fetchVariationAnalysis(userId, supabase).then(data => { context.variationAnalysis = data; }),
      fetchStatisticsMetrics(userId, supabase).then(data => { context.statistics = data; })
    );
  }
  
  if (messageLower.includes('treino') || messageLower.includes('plano') || messageLower.includes('workout')) {
    fetchPromises.push(
      fetchTrainingData(userId, supabase).then(data => { context.training = data; })
    );
  }
  
  if (messageLower.includes('objetivo') || messageLower.includes('meta') || messageLower.includes('prova') || messageLower.includes('corrida')) {
    fetchPromises.push(
      fetchUserGoals(userId, supabase).then(data => { context.goals = data; })
    );
  }
  
  if (messageLower.includes('cansado') || messageLower.includes('fadiga') || messageLower.includes('recuperação') || 
      messageLower.includes('forma') || messageLower.includes('fitness')) {
    fetchPromises.push(
      fetchFitnessScores(userId, supabase, 14).then(data => { context.fitness = data; })
    );
    
    // Also fetch sleep if not already fetching
    if (!context.sleep) {
      fetchPromises.push(
        fetchSleepData(userId, supabase, 7).then(data => { context.sleep = data; })
      );
    }
  }
  
  // Always fetch recent insights to avoid repetition
  fetchPromises.push(
    fetchRecentInsights(userId, supabase, 30).then(data => { context.insights = data; })
  );

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);

  return context;
}

// Build enriched system prompt
function buildEnrichedSystemPrompt(context: any): string {
  const enrichedContext = `
PERFIL DO ATLETA:
${context.profile ? `
- Nome: ${context.profile.display_name || 'Não informado'}
- Membro desde: ${new Date(context.profile.created_at).toLocaleDateString('pt-BR')}
${context.profile.birth_date ? `- Idade: ${calculateAge(context.profile.birth_date)} anos` : ''}
${context.profile.weight_kg ? `- Peso: ${context.profile.weight_kg} kg` : ''}
${context.profile.vo2_max ? `- VO2 max: ${context.profile.vo2_max}` : ''}
` : 'Sem dados de perfil'}

ATIVIDADES RECENTES (últimos 30 dias):
${context.recentActivities && context.recentActivities.length > 0 ? `
- Total: ${context.recentActivities.length} atividades
- Distância acumulada: ${(context.recentActivities.reduce((sum: number, a: any) => sum + (a.total_distance_meters || 0), 0) / 1000).toFixed(1)} km
- Tempo total: ${(context.recentActivities.reduce((sum: number, a: any) => sum + (a.total_time_minutes || 0), 0) / 60).toFixed(1)} horas
- Última atividade: ${context.recentActivities[0]?.activity_date} (${context.recentActivities[0]?.activity_type})
- Tipos de atividade: ${[...new Set(context.recentActivities.map((a: any) => a.activity_type))].join(', ')}
` : 'Sem dados de atividades recentes'}

${context.performance && context.performance.length > 0 ? `
MÉTRICAS DE PERFORMANCE:
${context.performance.slice(0, 5).map((p: any) => `- ${p.activity_date}: ${p.metric_type} = ${p.metric_value}`).join('\n')}
` : ''}

${context.statistics && context.statistics.length > 0 ? `
ESTATÍSTICAS DETALHADAS (últimas atividades):
${context.statistics.slice(0, 3).map((s: any) => `
- Atividade ${new Date(s.created_at).toLocaleDateString('pt-BR')}:
  * Pace médio: ${s.avg_pace_min_per_km || 'N/A'}
  * FC média: ${s.avg_heart_rate || 'N/A'} bpm
  * Cadência média: ${s.avg_cadence || 'N/A'} spm
`).join('')}
` : ''}

${context.variationAnalysis && context.variationAnalysis.length > 0 ? `
ANÁLISE DE CONSISTÊNCIA (pace e FC):
${context.variationAnalysis.slice(0, 3).map((v: any) => `
- ${new Date(v.created_at).toLocaleDateString('pt-BR')}:
  * Variação de pace: ${v.pace_cv_category || 'N/A'}
  * Variação de FC: ${v.heart_rate_cv_category || 'N/A'}
  * Diagnóstico: ${v.diagnosis || 'N/A'}
`).join('')}
` : ''}

${context.sleep?.summary ? `
DADOS DE SONO (últimos ${context.sleep.summary.daysTracked} dias):
- Score médio: ${context.sleep.summary.avgSleepScore}/100
- Tempo médio: ${context.sleep.summary.avgSleepTimeHours}h por noite
${context.sleep.records[0] ? `- Última noite: ${context.sleep.records[0].sleep_score || 'N/A'}/100 (${(context.sleep.records[0].sleep_time_in_seconds / 3600).toFixed(1)}h)` : ''}
${context.sleep.records[0]?.deep_sleep_duration_in_seconds ? `  * Sono profundo: ${(context.sleep.records[0].deep_sleep_duration_in_seconds / 3600).toFixed(1)}h` : ''}
${context.sleep.records[0]?.rem_sleep_duration_in_seconds ? `  * Sono REM: ${(context.sleep.records[0].rem_sleep_duration_in_seconds / 3600).toFixed(1)}h` : ''}
` : ''}

${context.fitness && context.fitness.length > 0 ? `
FITNESS SCORES (últimos dias):
- Fitness atual: ${context.fitness[0]?.fitness_score?.toFixed(1) || 'N/A'}
- ATL (fadiga aguda - 7 dias): ${context.fitness[0]?.atl_7day?.toFixed(1) || 'N/A'}
- CTL (forma crônica - 42 dias): ${context.fitness[0]?.ctl_42day?.toFixed(1) || 'N/A'}
- TSB (frescor): ${context.fitness[0]?.ctl_42day && context.fitness[0]?.atl_7day ? (context.fitness[0].ctl_42day - context.fitness[0].atl_7day).toFixed(1) : 'N/A'}
${context.fitness[0]?.daily_strain ? `- Carga de treino diária: ${context.fitness[0].daily_strain.toFixed(0)}` : ''}
` : ''}

${context.goals && context.goals.length > 0 ? `
OBJETIVOS DO ATLETA:
${context.goals.map((g: any) => `- ${g.goal_description} ${g.target_date ? `(meta: ${new Date(g.target_date).toLocaleDateString('pt-BR')})` : '(sem prazo)'}`).join('\n')}
` : ''}

${context.training ? `
PLANO DE TREINO ATIVO:
${context.training.plan ? `
- Nome: ${context.training.plan.plan_name}
- Objetivo: ${context.training.plan.goal_type}
- Duração: ${context.training.plan.duration_weeks} semanas
- Progresso: ${context.training.completionRate.toFixed(1)}% concluído (${context.training.workouts.filter((w: any) => w.status === 'completed').length}/${context.training.workouts.length} treinos)
- Próximos treinos: ${context.training.workouts.filter((w: any) => w.status === 'planned').slice(0, 3).map((w: any) => `${w.workout_type} em ${new Date(w.scheduled_date).toLocaleDateString('pt-BR')}`).join(', ')}
` : 'Sem plano de treino ativo'}
` : ''}

${context.insights && context.insights.length > 0 ? `
⚠️ INSIGHTS JÁ MENCIONADOS (últimos 30 dias):
${context.insights.map((i: any) => `- [${i.insight_type}] em ${new Date(i.created_at).toLocaleDateString('pt-BR')}`).join('\n')}
⚠️ IMPORTANTE: Evite repetir exatamente estes insights, a menos que haja mudanças significativas nos dados ou o usuário pergunte especificamente sobre eles.
` : ''}
`;

  const systemPrompt = `Você é o BioPeak AI Coach, um treinador inteligente especializado em corrida e esportes de resistência.

CONTEXTO COMPLETO DO ATLETA:
${enrichedContext}

SUAS RESPONSABILIDADES:
1. Analisar TODOS os dados disponíveis do atleta de forma holística
2. Fornecer insights personalizados, específicos e acionáveis
3. Identificar padrões, tendências e correlações entre diferentes métricas
4. Alertar proativamente sobre sinais de sobrecarga, fadiga ou risco de lesão
5. Motivar baseado em progresso real e conquistas mensuráveis
6. Sugerir ajustes específicos e práticos no treino
7. Responder perguntas com base em DADOS CONCRETOS do atleta

REGRAS CRÍTICAS:
✅ SEMPRE cite números e dados específicos nas suas respostas
✅ Faça correlações entre diferentes métricas (ex: sono ruim + FC elevada + treino pesado = risco de overtraining)
✅ Se detectar algo preocupante, alerte de forma clara mas não alarmista
✅ Evite repetir insights já mencionados (veja seção INSIGHTS JÁ MENCIONADOS)
✅ Se não tiver dados suficientes para responder, seja honesto e explique o que falta
✅ Mantenha tom profissional, motivacional mas realista
✅ Foque em insights ACIONÁVEIS, não genéricos ou óbvios
✅ Use linguagem acessível, evitando jargão técnico excessivo
✅ Responda SEMPRE em português brasileiro

❌ NÃO dê conselhos médicos ou de lesões - recomende procurar profissionais
❌ NÃO seja genérico - toda resposta deve ser personalizada aos dados do atleta
❌ NÃO ignore sinais de alerta nos dados
❌ NÃO faça promessas irrealistas sobre resultados

FORMATO DE RESPOSTA:
- Use parágrafos curtos e objetivos (máximo 3-4 linhas cada)
- Quando relevante, use emojis para destacar pontos importantes (mas com moderação)
- Estruture respostas longas em tópicos ou seções
- Sempre termine com uma recomendação clara, pergunta ou próximo passo
- Seja conversacional mas profissional

EXEMPLOS DE BOA ANÁLISE:
"Notei que nos últimos 7 dias sua carga de treino está 15% acima da média, mas seu score de sono caiu para 68/100 (vs 82 habitual). Isso pode indicar fadiga acumulada. Recomendo priorizar uma noite de sono de 8h+ hoje e considerar transformar o treino de amanhã em um treino leve ou descanso ativo."

"Excelente progressão! 🎉 Comparando com há 4 semanas, seu pace médio melhorou 8 seg/km e sua consistência aumentou (variação de pace caiu de 12% para 7%). Seus treinos intervalados estão dando resultado. Continue nessa linha!"
`;

  return systemPrompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const requestBody = await req.json();
    const { message, conversationHistory = [], conversationId: requestConversationId } = requestBody;

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }

    // Generate or use existing conversation ID
    const conversationId = requestConversationId || crypto.randomUUID();

    // Load conversation history if conversationId is provided and no history in request
    let fullConversationHistory = conversationHistory;
    
    if (requestConversationId && conversationHistory.length === 0) {
      const { data: previousMessages } = await supabaseClient
        .from('ai_coach_conversations')
        .select('role, content, created_at')
        .eq('conversation_id', requestConversationId)
        .order('created_at', { ascending: true });
        
      if (previousMessages && previousMessages.length > 0) {
        fullConversationHistory = previousMessages.map((m: any) => ({
          role: m.role,
          content: m.content
        }));
      }
    }

    // Build intelligent context based on user message
    console.log('Building intelligent context for user:', user.id);
    const intelligentContext = await buildIntelligentContext(user.id, message, supabaseClient);

    // Build enriched system prompt
    const systemPrompt = buildEnrichedSystemPrompt(intelligentContext);

    // Prepare messages for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...fullConversationHistory,
      { role: 'user', content: message }
    ];

    // Save user message
    await supabaseClient.from('ai_coach_conversations').insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: 'user',
      content: message
    });

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const data = await aiResponse.json();
    const responseText = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    // Save assistant message
    await supabaseClient.from('ai_coach_conversations').insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: 'assistant',
      content: responseText,
      context_used: {
        tables_queried: Object.keys(intelligentContext).filter(k => intelligentContext[k] !== null),
        activity_count: intelligentContext.recentActivities?.length || 0,
        has_sleep_data: !!intelligentContext.sleep,
        has_training_plan: !!intelligentContext.training,
        has_performance_data: !!intelligentContext.performance,
        has_fitness_data: !!intelligentContext.fitness
      },
      tokens_used: tokensUsed
    });

    // Update or create conversation session
    const { data: existingSession } = await supabaseClient
      .from('ai_coach_conversation_sessions')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (existingSession) {
      await supabaseClient
        .from('ai_coach_conversation_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: existingSession.message_count + 2,
          total_tokens_used: (existingSession.total_tokens_used || 0) + tokensUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    } else {
      // Generate title from first message
      const title = message.length > 50 ? message.substring(0, 47) + '...' : message;
      
      await supabaseClient
        .from('ai_coach_conversation_sessions')
        .insert({
          id: conversationId,
          user_id: user.id,
          title: title,
          last_message_at: new Date().toISOString(),
          message_count: 2,
          total_tokens_used: tokensUsed
        });
    }

    return new Response(
      JSON.stringify({ 
        response: responseText,
        conversationId: conversationId,
        tokensUsed: tokensUsed
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in ai-coach-chat function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
