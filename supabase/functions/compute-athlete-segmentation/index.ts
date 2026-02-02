import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = "https://grcwlmltlcltmwbhdpky.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface AthleteMetrics {
  userId: string;
  totalActivities: number;
  totalWeeks: number;
  weeklyDistanceKm: number;
  weeklyFrequency: number;
  avgPaceMinKm: number;
  paceImprovement: number;
  distanceImprovement: number;
  prCount: number;
  daysInactive: number;
  recentActivityDays: number;
  vo2Max: number | null;
  trainingPlanAdherence: number | null;
}

interface SegmentResult {
  segment: string;
  icon: string;
  color: string;
}

interface SegmentInfo {
  name: string;
  icon: string;
  color: string;
}

const SEGMENTS: Record<string, SegmentInfo> = {
  GETTING_STARTED: { name: "Getting Started", icon: "seedling", color: "green-300" },
  COMEBACK_HERO: { name: "Comeback Hero", icon: "flame", color: "orange" },
  RISING_STAR: { name: "Rising Star", icon: "rocket", color: "yellow" },
  SPEED_DEMON: { name: "Speed Demon", icon: "zap", color: "purple" },
  ENDURANCE_BUILDER: { name: "Endurance Builder", icon: "mountain", color: "green" },
  RECOVERY_MODE: { name: "Recovery Mode", icon: "moon", color: "gray" },
  CONSISTENT_PERFORMER: { name: "Consistent Performer", icon: "gem", color: "blue" },
};

function classifyAthlete(metrics: AthleteMetrics): SegmentResult {
  const {
    totalActivities,
    totalWeeks,
    weeklyFrequency,
    paceImprovement,
    distanceImprovement,
    prCount,
    daysInactive,
    recentActivityDays,
  } = metrics;

  // 1. Getting Started - dados insuficientes
  if (totalActivities < 8 || totalWeeks < 4) {
    const s = SEGMENTS.GETTING_STARTED;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 2. Comeback Hero - retornou de inatividade
  if (daysInactive > 14 && recentActivityDays <= 14) {
    const s = SEGMENTS.COMEBACK_HERO;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 3. Rising Star - melhorando rapidamente
  if (paceImprovement > 10 || distanceImprovement > 15 || prCount >= 2) {
    const s = SEGMENTS.RISING_STAR;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 4. Speed Demon - foco em velocidade
  if (paceImprovement > 5 && distanceImprovement < 5) {
    const s = SEGMENTS.SPEED_DEMON;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 5. Endurance Builder - foco em volume
  if (distanceImprovement > 10 && paceImprovement < 3) {
    const s = SEGMENTS.ENDURANCE_BUILDER;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 6. Recovery Mode - volume reduzido
  if (distanceImprovement < -20 || weeklyFrequency < 2) {
    const s = SEGMENTS.RECOVERY_MODE;
    return { segment: s.name, icon: s.icon, color: s.color };
  }

  // 7. Consistent Performer - padrão estável
  const s = SEGMENTS.CONSISTENT_PERFORMER;
  return { segment: s.name, icon: s.icon, color: s.color };
}

function calculateTrend(paceImprovement: number, distanceImprovement: number): string {
  const avgImprovement = (paceImprovement + distanceImprovement) / 2;
  if (avgImprovement > 5) return "up";
  if (avgImprovement < -5) return "down";
  return "stable";
}

function calculateCompositeScore(metrics: AthleteMetrics): number {
  let score = 50; // Base score

  // Consistency bonus (up to 20 points)
  score += Math.min(metrics.weeklyFrequency * 4, 20);

  // Improvement bonus (up to 15 points)
  score += Math.min(Math.max(metrics.paceImprovement, 0), 15);
  score += Math.min(Math.max(metrics.distanceImprovement, 0) * 0.5, 10);

  // PR bonus (5 points each, max 10)
  score += Math.min(metrics.prCount * 5, 10);

  // VO2 Max bonus (up to 10 points if available)
  if (metrics.vo2Max) {
    score += Math.min((metrics.vo2Max - 30) * 0.5, 10);
  }

  // Training plan adherence bonus (up to 10 points)
  if (metrics.trainingPlanAdherence) {
    score += metrics.trainingPlanAdherence * 0.1;
  }

  return Math.min(Math.max(score, 0), 100);
}

async function generateAIExplanation(
  segmentName: string,
  metrics: AthleteMetrics
): Promise<string> {
  const prompt = `Você é um coach de corrida experiente e motivador. Analise o perfil do atleta abaixo e escreva uma explicação personalizada (2-3 parágrafos, máximo 150 palavras) sobre sua performance recente.

**Categoria Atribuída:** ${segmentName}

**Métricas das Últimas 8 Semanas:**
- Distância Semanal Média: ${metrics.weeklyDistanceKm.toFixed(1)} km
- Frequência: ${metrics.weeklyFrequency.toFixed(1)} treinos/semana
- Pace Médio: ${formatPace(metrics.avgPaceMinKm)}
- Melhoria de Pace: ${metrics.paceImprovement.toFixed(1)}%
- Melhoria de Distância: ${metrics.distanceImprovement.toFixed(1)}%
- VO2 Max: ${metrics.vo2Max ? metrics.vo2Max.toFixed(1) : 'não disponível'}
- PRs Pessoais Recentes: ${metrics.prCount}
- Adesão ao Plano de Treino: ${metrics.trainingPlanAdherence ? `${metrics.trainingPlanAdherence.toFixed(0)}%` : 'sem plano ativo'}

**Instruções:**
1. Comece com uma frase positiva e encorajadora relacionada à categoria
2. Destaque 2-3 pontos fortes específicos baseados nos dados
3. Se houver espaço para melhoria, sugira de forma construtiva
4. Termine com uma frase motivacional curta
5. Use linguagem informal mas profissional, em português brasileiro
6. NÃO use emojis no texto`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um coach de corrida experiente e motivador." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return generateFallbackExplanation(segmentName, metrics);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || generateFallbackExplanation(segmentName, metrics);
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return generateFallbackExplanation(segmentName, metrics);
  }
}

function generateFallbackExplanation(segmentName: string, metrics: AthleteMetrics): string {
  const templates: Record<string, string> = {
    "Rising Star": `Você está em uma trajetória ascendente! Nas últimas 8 semanas, sua performance mostrou uma evolução impressionante com ${metrics.weeklyFrequency.toFixed(1)} treinos por semana e uma média de ${metrics.weeklyDistanceKm.toFixed(1)} km semanais. Continue assim!`,
    "Consistent Performer": `Sua consistência é admirável! Você mantém um ritmo sólido de ${metrics.weeklyFrequency.toFixed(1)} treinos semanais, o que é fundamental para resultados de longo prazo. A regularidade é a chave do sucesso.`,
    "Comeback Hero": `Que bom ver você de volta! Retomar os treinos depois de uma pausa exige determinação, e você está mostrando exatamente isso. Cada passo conta na sua jornada.`,
    "Endurance Builder": `Seu foco em construir resistência está dando frutos! Com ${metrics.weeklyDistanceKm.toFixed(1)} km por semana, você está desenvolvendo uma base aeróbica sólida que será essencial para futuros desafios.`,
    "Speed Demon": `Sua velocidade está impressionante! A melhoria no pace mostra que seu trabalho de intensidade está funcionando. Mantenha o equilíbrio entre velocidade e volume.`,
    "Recovery Mode": `Períodos de recuperação são essenciais para a evolução. Seu corpo está se adaptando e ficando mais forte. Use esse tempo para voltar ainda melhor.`,
    "Getting Started": `Bem-vindo à sua jornada! Os primeiros passos são os mais importantes. Continue registrando suas atividades e logo teremos dados suficientes para uma análise completa.`,
  };

  return templates[segmentName] || `Continue evoluindo! Com ${metrics.weeklyFrequency.toFixed(1)} treinos por semana, você está no caminho certo.`;
}

function formatPace(paceMinKm: number): string {
  if (!paceMinKm || paceMinKm <= 0) return "N/A";
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[compute-athlete-segmentation] Starting execution...");

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Get active users with recent activities (last 60 days)
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const today = new Date().toISOString().split("T")[0];

    // Fetch only ACTIVE SUBSCRIBERS with activities (uses RPC with JOIN on subscribers table)
    const { data: usersData, error: usersError } = await supabase
      .rpc('active_users_with_activities', { 
        p_start: eightWeeksAgo.toISOString().split("T")[0], 
        p_end: today 
      });

    if (usersError) {
      console.error("Error fetching active subscribers:", usersError);
      throw usersError;
    }

    const uniqueUserIds = (usersData ?? []).map((r: { user_id: string }) => r.user_id);
    console.log(`[compute-athlete-segmentation] Found ${uniqueUserIds.length} active subscribers`);
    let processedCount = 0;
    let errorCount = 0;

    for (const userId of uniqueUserIds) {
      try {
        // Fetch activities for this user (last 8 weeks)
        const { data: activities, error: activitiesError } = await supabase
          .from("all_activities")
          .select("activity_date, total_distance_meters, pace_min_per_km, total_time_minutes")
          .eq("user_id", userId)
          .gte("activity_date", eightWeeksAgo.toISOString().split("T")[0])
          .order("activity_date", { ascending: true });

        if (activitiesError || !activities || activities.length === 0) {
          continue;
        }

        // Fetch previous period activities (8-16 weeks ago)
        const sixteenWeeksAgo = new Date();
        sixteenWeeksAgo.setDate(sixteenWeeksAgo.getDate() - 112);

        const { data: previousActivities } = await supabase
          .from("all_activities")
          .select("activity_date, total_distance_meters, pace_min_per_km")
          .eq("user_id", userId)
          .gte("activity_date", sixteenWeeksAgo.toISOString().split("T")[0])
          .lt("activity_date", eightWeeksAgo.toISOString().split("T")[0]);

        // Fetch PRs (best 1km segments from last 8 weeks)
        const { data: prs } = await supabase
          .from("activity_best_segments")
          .select("best_1km_pace_min_km, activity_date")
          .eq("user_id", userId)
          .gte("activity_date", eightWeeksAgo.toISOString().split("T")[0])
          .not("best_1km_pace_min_km", "is", null)
          .order("best_1km_pace_min_km", { ascending: true })
          .limit(5);

        // Fetch VO2 Max
        const { data: vo2Data } = await supabase
          .from("garmin_activities")
          .select("vo2_max")
          .eq("user_id", userId)
          .not("vo2_max", "is", null)
          .order("activity_date", { ascending: false })
          .limit(1);

        // Calculate metrics
        const totalDistance = activities.reduce((sum, a) => sum + (a.total_distance_meters || 0), 0);
        const validPaces = activities.filter((a) => a.pace_min_per_km && a.pace_min_per_km > 0);
        const avgPace = validPaces.length > 0
          ? validPaces.reduce((sum, a) => sum + a.pace_min_per_km!, 0) / validPaces.length
          : 0;

        const weeklyDistanceKm = (totalDistance / 1000) / 8;
        const weeklyFrequency = activities.length / 8;

        // Calculate improvements
        let paceImprovement = 0;
        let distanceImprovement = 0;

        if (previousActivities && previousActivities.length > 0) {
          const prevTotalDistance = previousActivities.reduce((sum, a) => sum + (a.total_distance_meters || 0), 0);
          const prevValidPaces = previousActivities.filter((a) => a.pace_min_per_km && a.pace_min_per_km > 0);
          const prevAvgPace = prevValidPaces.length > 0
            ? prevValidPaces.reduce((sum, a) => sum + a.pace_min_per_km!, 0) / prevValidPaces.length
            : 0;

          if (prevAvgPace > 0) {
            paceImprovement = ((prevAvgPace - avgPace) / prevAvgPace) * 100;
          }
          if (prevTotalDistance > 0) {
            distanceImprovement = ((totalDistance - prevTotalDistance) / prevTotalDistance) * 100;
          }
        }

        // Calculate inactivity
        const sortedDates = activities.map((a) => new Date(a.activity_date!)).sort((a, b) => a.getTime() - b.getTime());
        let maxInactiveGap = 0;
        for (let i = 1; i < sortedDates.length; i++) {
          const gap = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          maxInactiveGap = Math.max(maxInactiveGap, gap);
        }

        const lastActivity = sortedDates[sortedDates.length - 1];
        const recentActivityDays = Math.floor((new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        // Count PRs (simplified - count unique best segments)
        const prCount = prs?.length || 0;

        const metrics: AthleteMetrics = {
          userId,
          totalActivities: activities.length,
          totalWeeks: 8,
          weeklyDistanceKm,
          weeklyFrequency,
          avgPaceMinKm: avgPace,
          paceImprovement,
          distanceImprovement,
          prCount,
          daysInactive: maxInactiveGap,
          recentActivityDays,
          vo2Max: vo2Data?.[0]?.vo2_max || null,
          trainingPlanAdherence: null, // TODO: Calculate from training_plans
        };

        // Classify athlete
        const classification = classifyAthlete(metrics);
        const trend = calculateTrend(paceImprovement, distanceImprovement);
        const compositeScore = calculateCompositeScore(metrics);

        // Generate AI explanation
        const aiExplanation = await generateAIExplanation(classification.segment, metrics);

        // Save to database
        const { error: insertError } = await supabase.from("athlete_segmentation").upsert(
          {
            user_id: userId,
            segment_name: classification.segment,
            badge_icon: classification.icon,
            badge_color: classification.color,
            ai_explanation: aiExplanation,
            metrics_snapshot: {
              weekly_distance_km: weeklyDistanceKm,
              weekly_frequency: weeklyFrequency,
              avg_pace_min_km: avgPace,
              pace_improvement_percent: paceImprovement,
              distance_improvement_percent: distanceImprovement,
              vo2_max: metrics.vo2Max,
              personal_records_count: prCount,
              training_plan_adherence_percent: metrics.trainingPlanAdherence,
            },
            composite_score: compositeScore,
            trend,
            analysis_period_start: eightWeeksAgo.toISOString().split("T")[0],
            analysis_period_end: today,
            segmentation_date: today,
          },
          { onConflict: "user_id,segmentation_date" }
        );

        if (insertError) {
          console.error(`Error saving segmentation for user ${userId}:`, insertError);
          errorCount++;
        } else {
          processedCount++;
        }
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[compute-athlete-segmentation] Completed in ${duration}ms. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[compute-athlete-segmentation] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
