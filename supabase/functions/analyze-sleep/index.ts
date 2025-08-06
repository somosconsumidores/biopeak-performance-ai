import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧠 Sleep Analysis: Starting AI analysis');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { sleepData, overtrainingData } = await req.json();

    console.log('🧠 Sleep Analysis: Received data', { 
      sleepScore: sleepData?.sleepScore,
      overtrainingLevel: overtrainingData?.level 
    });

    // Format sleep duration and stages
    const totalDuration = sleepData?.totalSleep || 0;
    const lightSleep = sleepData?.lightSleep || 0;
    const deepSleep = sleepData?.deepSleep || 0;
    const remSleep = sleepData?.remSleep || 0;
    
    // Format overtraining data
    const overtrainingFactors = Array.isArray(overtrainingData?.factors) 
      ? overtrainingData.factors.join(', ') 
      : 'Nenhum fator específico identificado';

    // Prepare the exact prompt as specified
    const systemPrompt = `Você é um especialista em neurociência do sono, performance atlética, análise de overtraining e inteligência artificial aplicada à saúde. Sua missão é analisar dados de sono E risco de overtraining de um atleta de alta performance, identificando correlações críticas entre qualidade do sono e estado de treinamento. A análise deve ser disruptiva, detectando padrões sutis entre sono, recuperação e risco de sobretreinamento.`;

    const userPrompt = `Aqui estão os dados de sono do usuário:

📊 Score geral de sono: ${sleepData?.sleepScore || 'N/A'}
⏱️ Duração total do sono: ${totalDuration} minutos
🌘 Sono leve: ${lightSleep} minutos
🌑 Sono profundo: ${deepSleep} minutos
💤 Sono REM: ${remSleep} minutos

🏃‍♂️ Risco de Overtraining: ${overtrainingData?.level || 'baixo'} (${overtrainingData?.score || 0}/100)
⚠️ Fatores identificados: ${overtrainingFactors}

IMPORTANTE: Mencione nominalmente o score de overtraining (${overtrainingData?.score || 0}/100) nas suas análises para dar mais credibilidade.

Com base nesses dados, responda de forma limpa e direta (sem usar asteriscos * para formatação):

1. 📈 Qual é a **eficiência e qualidade fisiológica** do sono desse atleta hoje?
2. 🧠 Quais **impactos esperados** esse padrão de sono pode ter na **recuperação neural, cognição e tempo de reação**?
3. 💪 Há indícios de risco de **fadiga acumulada**, **overtraining** ou **sub-recuperação muscular**?
4. 🔄 Compare a proporção entre fases (REM, deep, light) com o ideal para atletas. Onde há desvios significativos?
5. 🚀 Dê sugestões **extremamente personalizadas e acionáveis** para otimizar o sono nas próximas 24h (ex: estratégias de luz, temperatura, alimentação, respiração, etc.).
6. 🌡️ Detecte qualquer **anomalia crônica ou tendência preocupante** se possível (baseado apenas nesta entrada).
7. 🔗 Como o atual risco de overtraining se correlaciona com a qualidade do sono? Há sinais de que o sono está sendo impactado pelo stress do treino ou vice-versa?

Finalize com um insight que seria digno de ser citado por um cientista de ponta ou treinador olímpico.`;

    console.log('🧠 Sleep Analysis: Calling OpenAI API');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('🧠 Sleep Analysis: Analysis completed successfully');

    return new Response(JSON.stringify({ 
      analysis,
      analyzedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🧠 Sleep Analysis Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to analyze sleep data'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});