// Edge function to get enhanced weekly summary statistics for all users
// Returns comprehensive metrics including performance, comparison, and motivational badges
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklySummary {
  user_id: string;
  email: string;
  display_name: string;
  total_km: number;
  activities_count: number;
  active_days: number;
  calories: number;
  total_hours: number;
  avg_pace_min_km: number | null;
  avg_heart_rate: number | null;
  max_heart_rate_week: number | null;
  total_elevation_gain: number;
  longest_distance_km: number;
  longest_duration_hours: number;
  best_pace_min_km: number | null;
  prev_total_km: number;
  prev_activities_count: number;
  distance_change_percent: number | null;
  activities_change: number | null;
  activity_types: Record<string, number>;
  consistency_score: number;
  avg_km_per_activity: number;
}

function calculateBadges(summary: WeeklySummary): string[] {
  const badges: string[] = [];
  
  // 🔥 Semana Consistente (5+ dias ativos)
  if (summary.active_days >= 5) {
    badges.push("🔥 Semana Consistente");
  }
  
  // 🚀 Semana Intensa (40+ km OU 5+ horas)
  if (summary.total_km >= 40 || summary.total_hours >= 5) {
    badges.push("🚀 Semana Intensa");
  }
  
  // 📈 Em Progresso (crescimento de 10%+ vs semana anterior)
  if (summary.distance_change_percent !== null && summary.distance_change_percent >= 10) {
    badges.push("📈 Em Progresso");
  }
  
  // ⚡ Velocista (pace médio < 5:00/km)
  if (summary.avg_pace_min_km && summary.avg_pace_min_km < 5.0) {
    badges.push("⚡ Velocista");
  }
  
  // 🏔️ Montanhista (500+ metros de elevação)
  if (summary.total_elevation_gain >= 500) {
    badges.push("🏔️ Montanhista");
  }
  
  // 🎯 Multiesportista (3+ tipos de atividade)
  if (Object.keys(summary.activity_types || {}).length >= 3) {
    badges.push("🎯 Multiesportista");
  }
  
  // 🆕 Primeira Semana (novo usuário)
  if (summary.prev_activities_count === 0) {
    badges.push("🆕 Primeira Semana");
  }
  
  return badges;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular semana atual (segunda a domingo anterior)
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0 = domingo
    const lastMonday = new Date(today);
    lastMonday.setUTCDate(today.getUTCDate() - dayOfWeek - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

    // Calcular semana anterior (7 dias antes)
    const previousMonday = new Date(lastMonday);
    previousMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    const previousSunday = new Date(lastSunday);
    previousSunday.setUTCDate(lastSunday.getUTCDate() - 7);

    const startDate = lastMonday.toISOString().slice(0, 10);
    const endDate = lastSunday.toISOString().slice(0, 10);
    const prevStartDate = previousMonday.toISOString().slice(0, 10);
    const prevEndDate = previousSunday.toISOString().slice(0, 10);

    console.log(`📅 Current week: ${startDate} to ${endDate}`);
    console.log(`📅 Previous week: ${prevStartDate} to ${prevEndDate}`);

    // Chamar função SQL aprimorada
    const { data, error } = await supabase.rpc("weekly_summary_stats_v2", {
      start_date: startDate,
      end_date: endDate,
      previous_start_date: prevStartDate,
      previous_end_date: prevEndDate,
    });

    if (error) {
      console.error("❌ Error fetching weekly summary:", error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Fetched ${data?.length || 0} user summaries`);

    // Enriquecer dados com badges e estruturar vs_last_week
    const enrichedData = (data as WeeklySummary[]).map(summary => ({
      ...summary,
      badges: calculateBadges(summary),
      vs_last_week: {
        distance_change_percent: summary.distance_change_percent,
        activities_change: summary.activities_change
      }
    }));

    console.log(`🏅 Badges calculated for all users`);

    return new Response(
      JSON.stringify(enrichedData), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Unexpected error in weekly-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
