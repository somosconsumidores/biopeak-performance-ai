import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function getDateForWeekday(startDate: Date, weekNumber: number, weekdayIdx: number) {
  // Week 1 starts at startDate. We advance (weekNumber-1)*7 days, then adjust to desired weekday.
  const base = addDays(startDate, (weekNumber - 1) * 7);
  const baseIdx = base.getUTCDay(); // 0-6 (Sun-Sat)
  const diff = weekdayIdx - baseIdx;
  return addDays(base, diff >= 0 ? diff : diff);
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

    // Resolve user from token (required to validate ownership)
    const { data: userResult } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userResult?.user;
    if (!user) throw new Error("Invalid auth token");

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body.plan_id;
    if (!planId) throw new Error("plan_id is required");

    console.log(`🚀 generate-training-plan start for plan ${planId}`);

    // Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from("training_plans")
      .select("id, user_id, plan_name, goal_type, start_date, end_date, weeks, target_event_date, status")
      .eq("id", planId)
      .maybeSingle();

    if (planErr || !plan) throw new Error("Plan not found");
    if (plan.user_id !== user.id) throw new Error("Not authorized to generate this plan");

    // Fetch preferences
    const { data: prefs } = await supabase
      .from("training_plan_preferences")
      .select("days_per_week, days_of_week, long_run_weekday, start_date")
      .eq("plan_id", planId)
      .maybeSingle();

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, birth_date, weight_kg, height_cm, gender")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch recent unified activities (last 180 days)
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 180);
    const sinceStr = sinceDate.toISOString().slice(0, 10);

    const { data: activities } = await supabase
      .from("all_activities")
      .select("activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type")
      .eq("user_id", user.id)
      .gte("activity_date", sinceStr)
      .order("activity_date", { ascending: false });

    // Aggregate basics
    const runs = (activities || []).filter((a) => (a.activity_type || "").toLowerCase().includes("run"));
    const paces = runs.map((r: any) => Number(r.pace_min_per_km)).filter((v) => Number.isFinite(v) && v > 0);
    const bestPace = paces.length ? Math.min(...paces) : null;
    const avgPace = paces.length ? paces.reduce((s, v) => s + v, 0) / paces.length : null;
    const avgHrVals = runs.map((r: any) => Number(r.average_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const avgHr = avgHrVals.length ? Math.round(avgHrVals.reduce((s, v) => s + v, 0) / avgHrVals.length) : null;
    const maxHrVals = runs.map((r: any) => Number(r.max_heart_rate)).filter((v) => Number.isFinite(v) && v > 0);
    const observedMaxHr = maxHrVals.length ? Math.max(...maxHrVals) : null;

    // Weekly patterns
    const byWeek = new Map<string, { count: number; distance: number }>();
    runs.forEach((r: any) => {
      const d = new Date(r.activity_date);
      const year = d.getUTCFullYear();
      const week = Math.ceil(((+d - +new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000 + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      const prev = byWeek.get(key) || { count: 0, distance: 0 };
      byWeek.set(key, { count: prev.count + 1, distance: prev.distance + Number(r.total_distance_meters || 0) });
    });
    const lastWeeks = Array.from(byWeek.values()).slice(0, 8);
    const avgWeeklyFrequency = lastWeeks.length ? Number((lastWeeks.reduce((s, v) => s + v.count, 0) / lastWeeks.length).toFixed(2)) : 0;
    const avgWeeklyDistanceKm = lastWeeks.length ? Number(((lastWeeks.reduce((s, v) => s + v.distance, 0) / lastWeeks.length) / 1000).toFixed(1)) : 0;

    // Build AI prompt
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const haveKey = !!openAIApiKey;

    const context = {
      userId: user.id,
      plan: {
        id: plan.id,
        goal_type: plan.goal_type,
        weeks: plan.weeks,
        start_date: plan.start_date,
        end_date: plan.end_date,
        target_event_date: plan.target_event_date,
      },
      preferences: prefs || null,
      profile: profile || null,
      historySummary: {
        activities_considered: runs.length,
        avg_pace_min_km: avgPace,
        best_pace_min_km: bestPace,
        avg_hr_bpm: avgHr,
        observed_max_hr_bpm: observedMaxHr,
        avg_weekly_frequency: avgWeeklyFrequency,
        avg_weekly_distance_km: avgWeeklyDistanceKm,
      },
    };

    let aiPlan: any = null;

    if (!haveKey) {
      console.log("⚠️ OPENAI_API_KEY not set. Using fallback template generation.");
      // Simple deterministic generator: base/build/peak/taper with naive workouts
      aiPlan = {
        plan_summary: {
          periodization: ["base", "build", "peak", "taper"],
        },
        workouts: Array.from({ length: plan.weeks }).flatMap((_, idx) => {
          const w = idx + 1;
          const longDay = (prefs?.long_run_weekday ?? 6); // default Saturday
          const days = (prefs?.days_of_week ?? [1, 3, 5, 6]).slice(0, prefs?.days_per_week ?? 4);
          return days.map((dow, i) => ({
            week: w,
            weekday: Object.keys(dayToIndex).find((k) => dayToIndex[k] === dow) || "saturday",
            type: dow === longDay ? "long_run" : i % 3 === 0 ? "interval" : i % 2 === 0 ? "tempo" : "easy",
            title: dow === longDay ? `Longão Semana ${w}` : `Treino ${i + 1} Semana ${w}`,
            description: "Treino gerado automaticamente (fallback)",
            distance_km: dow === longDay ? 10 + w : 5 + Math.floor(w / 2),
            duration_min: null,
            target_hr_zone: dow === longDay ? 2 : i % 3 === 0 ? 4 : 2,
            target_pace_min_per_km: null,
            intensity: dow === longDay ? "moderate" : i % 3 === 0 ? "high" : "low",
          }));
        }),
      };
    } else {
      const system = `Você é um treinador de corrida especializado. Gere um plano semanal detalhado com periodização (base→build→peak→taper) para ${plan.weeks} semanas, respeitando os dias disponíveis do atleta e preferindo o longão no dia configurado. Inclua treinos com tipo, título, descrição, duração ou distância, zona de FC e pace-alvo quando aplicável. Responda SOMENTE em JSON válido.`;

      const userPrompt = {
        context,
        required_output_schema: {
          plan_summary: {
            periodization: ["base", "build", "peak", "taper"],
            notes: "string (opcional)",
          },
          workouts: [
            {
              week: "1..N",
              weekday: "one of sunday,monday,tuesday,wednesday,thursday,friday,saturday",
              type: "easy|long_run|interval|tempo|recovery|rest",
              title: "string",
              description: "string",
              distance_km: "number|null",
              duration_min: "number|null",
              target_hr_zone: "1..5|null",
              target_pace_min_per_km: "string|min/km range|null",
              intensity: "low|moderate|high",
            },
          ],
          rules: [
            "Use apenas dias da semana presentes em preferences.days_of_week",
            "Garanta que long_run caia em preferences.long_run_weekday quando possível",
            "Distribua a carga respeitando periodização e objetivo",
            "Mantenha volume semanal compatível com histórico",
            "Inclua dias de recuperação e/ou descanso",
          ],
        },
      };

      console.log("🤖 Calling OpenAI for plan generation...");
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(userPrompt) },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!openaiRes.ok) {
        const txt = await openaiRes.text();
        console.error("OpenAI error:", txt);
        throw new Error("Failed to generate plan with OpenAI");
      }

      const openaiJson = await openaiRes.json();
      const content = openaiJson.choices?.[0]?.message?.content || "";
      const cleaned = String(content).replace(/```json|```/gi, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : cleaned;
      try {
        aiPlan = JSON.parse(jsonStr);
        console.log("✅ AI plan parsed");
      } catch (e) {
        console.error("JSON parse error", e);
        throw new Error("Invalid JSON from OpenAI");
      }
    }

    // Map AI workouts to DB rows
    const startDate = new Date(plan.start_date);
    const workouts = (aiPlan?.workouts || []).filter((w: any) => w.type !== "rest");

    const rows = workouts.map((w: any) => {
      const weekdayIdx = dayToIndex[(w.weekday || "").toLowerCase()] ?? 6; // default Saturday
      const date = getDateForWeekday(startDate, Number(w.week) || 1, weekdayIdx);
      const distance_meters = typeof w.distance_km === "number" ? Math.round(w.distance_km * 1000) : null;
      const duration_minutes = typeof w.duration_min === "number" ? w.duration_min : null;

      return {
        user_id: user.id,
        plan_id: plan.id,
        workout_date: formatDate(date),
        title: String(w.title || `${w.type} run`).slice(0, 120),
        description: w.description || null,
        workout_type: w.type || null,
        target_pace_min_km: null, // store numeric later if needed
        target_hr_zone: w.target_hr_zone ? String(w.target_hr_zone) : null,
        distance_meters,
        duration_minutes,
        status: "planned",
        completed_activity_source: null,
        completed_activity_id: null,
      } as const;
    });

    // Clean previous generated workouts for this plan (idempotency)
    await supabase.from("training_plan_workouts").delete().eq("plan_id", plan.id);

    // Insert in chunks to avoid payload limits
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from("training_plan_workouts").insert(chunk);
      if (insErr) {
        console.error("Insert workouts error:", insErr);
        throw new Error("Failed to save workouts");
      }
    }

    // Update plan status
    const { error: updErr } = await supabase
      .from("training_plans")
      .update({ status: "active", generated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (updErr) console.warn("Failed to update plan status", updErr);

    return new Response(
      JSON.stringify({
        ok: true,
        plan_id: plan.id,
        workouts_created: rows.length,
        summary: aiPlan?.plan_summary || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("❌ generate-training-plan error:", err?.message || err);
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
