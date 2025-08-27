import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Utilities
const dayToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateForWeekday(
  startDate: Date,
  weekNumber: number,
  weekdayIdx: number,
) {
  const base = addDays(startDate, (weekNumber - 1) * 7);
  const baseIdx = base.getUTCDay(); // 0-6 (Sun-Sat)
  const diff = weekdayIdx - baseIdx;
  return addDays(base, diff >= 0 ? diff : diff);
}

// ================================
// SAFETY CALIBRATOR
// ================================
class SafetyCalibrator {
  runs: any[];
  profile: any;
  constructor(runs: any[], profile: any) {
    this.runs = runs;
    this.profile = profile;
  }

  getValidRunData() {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return (this.runs || []).filter((r: any) => {
      const pace = Number(r.pace_min_per_km);
      const dist = Number(r.total_distance_meters || 0) / 1000;
      const dur = Number(r.total_time_minutes || 0);
      const date = new Date(r.activity_date);
      return (
        Number.isFinite(pace) && Number.isFinite(dist) && Number.isFinite(dur) &&
        pace > 3 && pace < 12 &&
        dist >= 2 &&
        dur >= 10 &&
        date >= cutoffDate
      );
    });
  }

  calculateBaselines() {
    const valid = this.getValidRunData();
    if (!valid.length) return this.getDefaults();

    const paces = valid.map((r: any) => Number(r.pace_min_per_km)).sort(
      (a: number, b: number) => a - b,
    );
    const best = paces[0];
    const median = paces[Math.floor(paces.length / 2)];
    const p75 = paces[Math.floor(paces.length * 0.75)];

    const base5kMin = best * 5;
    const riegel = (t1: number, d1: number, d2: number) =>
      t1 * Math.pow(d2 / d1, 1.06);

    const pace_10k = riegel(base5kMin, 5, 10) / 10;
    const pace_half = riegel(base5kMin, 5, 21.097) / 21.097;
    const pace_marathon = riegel(base5kMin, 5, 42.195) / 42.195;

    return {
      pace_best: best,
      pace_median: median,
      pace_p75: p75,
      pace_5k: best,
      pace_10k,
      pace_half,
      pace_marathon,
      pace_easy: Math.max(median + 1.0, p75),
      pace_long: Math.max(median + 0.7, p75),
      pace_tempo: best + 0.35,
      pace_interval_400m: best - 0.15,
      pace_interval_800m: best,
      pace_interval_1km: best + 0.10,
      pace_half_marathon: pace_half,
    };
  }

  getDefaults() {
    const age = this.profile?.birth_date
      ? Math.floor(
        (Date.now() - new Date(this.profile.birth_date).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
      : 35;
    const base = age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
    return {
      pace_best: base,
      pace_median: base,
      pace_p75: base + 0.5,
      pace_5k: base,
      pace_10k: base * 1.08,
      pace_half: base * 1.15,
      pace_marathon: base * 1.25,
      pace_easy: base + 1.0,
      pace_long: base + 0.7,
      pace_tempo: base * 0.95,
      pace_interval_400m: base * 0.9,
      pace_interval_800m: base * 0.95,
      pace_interval_1km: base,
      pace_half_marathon: base * 1.15,
    };
  }

  applySafetyClamps(type: string, pace: number, duration?: number) {
    const b = this.calculateBaselines();
    let safe = pace;
    const warnings: string[] = [];

    switch ((type || "").toLowerCase()) {
      case "easy":
      case "recovery":
        if (safe < b.pace_10k + 0.5) {
          safe = b.pace_10k + 0.5;
          warnings.push("Easy ajustado para manter Z2.");
        }
        break;
      case "long_run":
        if (safe < b.pace_10k + 0.4) {
          safe = b.pace_10k + 0.4;
          warnings.push("Long run ajustado para manter aeróbico.");
        }
        break;
      case "tempo":
        if (safe < b.pace_10k) {
          safe = b.pace_10k;
          warnings.push("Tempo não pode ser mais rápido que 10k.");
        }
        if (duration && duration > 45) {
          warnings.push("Tempo >45min não recomendado.");
        }
        break;
      case "interval":
        if (safe < b.pace_best) {
          safe = b.pace_best;
          warnings.push("Intervalo não pode ser mais rápido que melhor pace observado.");
        }
        break;
    }

    return { pace: safe, warnings };
  }

  getSafeTargetPaces() {
    return this.calculateBaselines();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userResult } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const user = userResult?.user;
    if (!user) throw new Error("Invalid auth token");

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body.plan_id;
    if (!planId) throw new Error("plan_id is required");

    const { data: plan } = await supabase
      .from("training_plans")
      .select(
        "id, user_id, plan_name, goal_type, start_date, end_date, weeks, target_event_date, status",
      )
      .eq("id", planId)
      .maybeSingle();

    const { data: prefs } = await supabase
      .from("training_plan_preferences")
      .select("days_per_week, days_of_week, long_run_weekday, start_date")
      .eq("plan_id", planId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, birth_date, weight_kg, height_cm, gender")
      .eq("user_id", user.id)
      .maybeSingle();

    // Atividades recentes
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 180);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const { data: activities } = await supabase
      .from("all_activities")
      .select(
        "activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type",
      )
      .eq("user_id", user.id)
      .gte("activity_date", sinceStr)
      .order("activity_date", { ascending: false });

    const runs = (activities || []).filter((a) =>
      (a.activity_type || "").toLowerCase().includes("run")
    );

    const safetyCalibrator = new SafetyCalibrator(runs, profile);
    const safeTargetPaces = safetyCalibrator.getSafeTargetPaces();

    // Build context
    const context = {
      userId: user.id,
      plan,
      preferences: prefs,
      profile,
      targetPaces: safeTargetPaces,
    };

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    let aiPlan: any = null;

    if (openAIApiKey) {
      const system = `Você é um treinador especializado em ${plan.goal_type}. 
Crie um plano científico de ${plan.weeks} semanas com foco em ${plan.goal_type}.`;

      const userPrompt = {
        context,
        required_output_schema: {
          plan_summary: {
            periodization: ["base", "build", "peak", "taper"],
            notes: "Plano científico com paces personalizados",
            targets: {
              type: "object",
              properties: {
                target_pace_min_km: { type: "number" },
                target_time_minutes: { type: "number" },
              },
              required: ["target_pace_min_km", "target_time_minutes"],
            },
          },
          workouts: [
            {
              week: "1..N",
              weekday:
                "one of sunday,monday,tuesday,wednesday,thursday,friday,saturday",
              type: "easy|long_run|interval|tempo|recovery|race_pace_run",
              title: "string",
              description: "string",
              distance_km: "number|null",
              duration_min: "number|null",
              target_hr_zone: "1..5|null",
              target_pace_min_per_km: "string",
              intensity: "low|moderate|high",
              specific_instructions: "string",
            },
          ],
        },
      };

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini-2025-08-07",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(userPrompt) },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 4000,
        }),
      });

      aiPlan = await openaiRes.json();
    }

    return new Response(JSON.stringify({
      ok: true,
      plan_id: plan.id,
      plan: aiPlan,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
