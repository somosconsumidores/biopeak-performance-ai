import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { coachTools } from "./tools.ts";
import { executeToolCall } from "./executor.ts";

// AI Coach Chat - Phase 2: Tool Calling for Autonomous Actions
// Last updated: 2026-02-05 - Added tool calling support

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TOOL_ITERATIONS = 5;
const AI_MODEL = 'google/gemini-2.5-flash';

// System prompt for the autonomous coach
function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  
  return `Você é o BioPeak AI Coach, um treinador inteligente e AUTÔNOMO especializado em corrida e esportes de resistência.

DATA DE HOJE: ${today}

## SEU SUPERPODER: TOOLS
Você tem acesso a ferramentas (tools) que permitem:
1. **BUSCAR DADOS** do atleta automaticamente (atividades, sono, plano de treino, métricas)
2. **EXECUTAR AÇÕES** no sistema (reagendar treinos, criar workouts, marcar como concluído)

### REGRA DE OURO:
🔥 **NUNCA peça ao usuário dados que você pode buscar com tools!**
Se o usuário perguntar sobre "meu último treino", use \`get_last_activity\`.
Se perguntar sobre "meu plano", use \`get_training_plan\`.
Se quiser reagendar, use \`reschedule_workout\`.

### TOOLS DISPONÍVEIS:
**Consulta:**
- \`get_last_activity\`: Última atividade (com detalhes de pace, FC, etc)
- \`get_activity_by_date\`: Atividade em data específica
- \`get_activities_range\`: Atividades em um período
- \`get_training_plan\`: Plano ativo e próximos treinos
- \`get_sleep_data\`: Dados de sono
- \`get_fitness_scores\`: CTL, ATL, TSB (forma/fadiga)
- \`get_user_profile\`: Perfil do atleta
- \`get_user_goals\`: Objetivos e metas
- \`compare_activities\`: Comparar evolução

**Ações:**
- \`reschedule_workout\`: Mover treino para outra data
- \`create_custom_workout\`: Criar novo treino
- \`mark_workout_complete\`: Marcar treino como feito
- \`skip_workout\`: Pular treino com motivo

## COMPORTAMENTO ESPERADO:

### Quando o usuário perguntar sobre treinos/atividades:
1. Use a tool apropriada para buscar os dados REAIS
2. Analise os dados recebidos
3. Responda com insights específicos e números concretos

### Quando o usuário pedir uma ação:
1. Use get_training_plan primeiro para entender o contexto
2. Execute a ação com a tool apropriada
3. Confirme o que foi feito

### Exemplo de fluxo:
Usuário: "Como foi meu último treino?"
→ Chame: get_last_activity()
→ Receba: {distance: 8.5km, pace: 5:23, hr_avg: 152...}
→ Responda: "Seu treino de hoje foi excelente! 8.5km em pace médio de 5:23/km..."

Usuário: "Preciso adiar o treino de amanhã para sexta"
→ Chame: get_training_plan() para ver os treinos
→ Identifique as datas corretas
→ Chame: reschedule_workout(from_date: "2026-02-06", to_date: "2026-02-07")
→ Responda: "Pronto! Seu treino de intervalados foi movido para sexta-feira."

## FORMATO DE RESPOSTA:
- Parágrafos curtos (3-4 linhas max)
- Use emojis com moderação para destaque
- Sempre cite números específicos dos dados
- Termine com próximo passo ou pergunta quando apropriado
- Responda SEMPRE em português brasileiro

## REGRAS CRÍTICAS:
✅ Use tools para buscar dados - NUNCA peça ao usuário
✅ Cite números e dados específicos das tools
✅ Execute ações quando solicitado
✅ Seja proativo em sugerir análises baseadas nos dados
❌ NÃO invente dados - use apenas o que as tools retornarem
❌ NÃO dê conselhos médicos - recomende profissionais
❌ NÃO seja genérico - personalize com dados reais`;
}

// Call AI with tools
async function callAIWithTools(messages: any[], tools: any[]) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  return await response.json();
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

    const conversationId = requestConversationId || crypto.randomUUID();
    console.log(`[AI Coach] User: ${user.id}, Conversation: ${conversationId}`);

    // Load conversation history if needed
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

    // Save user message
    await supabaseClient.from('ai_coach_conversations').insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: 'user',
      content: message
    });

    // Build messages array with system prompt
    const systemPrompt = buildSystemPrompt();
    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...fullConversationHistory,
      { role: 'user', content: message }
    ];

    // Tool calling loop
    let iterations = 0;
    let finalResponse: string | null = null;
    let totalTokens = 0;
    const toolCallsLog: any[] = [];

    console.log(`[AI Coach] Starting tool calling loop...`);

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      console.log(`[AI Coach] Iteration ${iterations}`);

      const aiResponse = await callAIWithTools(messages, coachTools);
      totalTokens += aiResponse.usage?.total_tokens || 0;

      const assistantMessage = aiResponse.choices[0].message;

      // Check if AI wants to use tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[AI Coach] Tool calls requested: ${assistantMessage.tool_calls.map((t: any) => t.function.name).join(', ')}`);
        
        // Add assistant message with tool calls to history
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error(`[AI Coach] Failed to parse tool arguments for ${toolName}:`, e);
          }

          const { result, isAction } = await executeToolCall(
            toolName, 
            toolArgs, 
            supabaseClient, 
            user.id
          );

          toolCallsLog.push({
            tool: toolName,
            args: toolArgs,
            result_summary: typeof result === 'object' ? Object.keys(result) : 'primitive',
            is_action: isAction
          });

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      } else {
        // No more tool calls, we have the final response
        finalResponse = assistantMessage.content;
        console.log(`[AI Coach] Final response received after ${iterations} iteration(s)`);
        break;
      }
    }

    // If we hit max iterations without a final response
    if (!finalResponse) {
      console.warn(`[AI Coach] Hit max iterations (${MAX_TOOL_ITERATIONS}), forcing final response`);
      
      // Make one more call without tools to get final response
      const finalCall = await callAIWithTools(
        [...messages, { role: 'user', content: 'Por favor, forneça sua resposta final ao usuário com base nos dados coletados.' }],
        [] // No tools
      );
      finalResponse = finalCall.choices[0].message.content;
      totalTokens += finalCall.usage?.total_tokens || 0;
    }

    // Save assistant response
    await supabaseClient.from('ai_coach_conversations').insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: 'assistant',
      content: finalResponse,
      context_used: {
        tool_calls: toolCallsLog,
        iterations,
        model: AI_MODEL
      },
      tokens_used: totalTokens
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
          total_tokens_used: (existingSession.total_tokens_used || 0) + totalTokens,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    } else {
      const title = message.length > 50 ? message.substring(0, 47) + '...' : message;
      
      await supabaseClient
        .from('ai_coach_conversation_sessions')
        .insert({
          id: conversationId,
          user_id: user.id,
          title,
          last_message_at: new Date().toISOString(),
          message_count: 2,
          total_tokens_used: totalTokens
        });
    }

    console.log(`[AI Coach] Completed. Tools used: ${toolCallsLog.length}, Tokens: ${totalTokens}`);

    return new Response(
      JSON.stringify({ 
        response: finalResponse,
        conversationId,
        tokensUsed: totalTokens,
        toolsUsed: toolCallsLog.length
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
