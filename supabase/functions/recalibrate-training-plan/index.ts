import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Admin-only function
    const { data: userResult } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userResult?.user;
    if (!user) throw new Error("Invalid auth token");
    
    // Check if user is admin (optional - owner can also run)
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!userRole;

    const body = await req.json().catch(() => ({}));
    const { plan_id, user_email } = body;

    console.log(`🔧 CRITICAL SAFETY RECALIBRATION - Plan: ${plan_id}, User: ${user_email}`);

    let targetPlanId = plan_id;
    
    // If user_email provided, find their active plan
    if (user_email && !plan_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", user_email)
        .maybeSingle();
        
      if (!profile) throw new Error(`User not found: ${user_email}`);
      
      const { data: activePlan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("status", "active")
        .maybeSingle();
        
      if (!activePlan) throw new Error(`No active plan found for user: ${user_email}`);
      targetPlanId = activePlan.id;
    }

    if (!targetPlanId) throw new Error("plan_id or user_email required");

    // Get plan and user data
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id, user_id, goal_type")
      .eq("id", targetPlanId)
      .maybeSingle();

    if (!plan) throw new Error("Plan not found");

    if (!isAdmin && user.id !== plan.user_id) {
      throw new Error("Unauthorized: only the plan owner or an admin can recalibrate");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("birth_date, email")
      .eq("user_id", plan.user_id)
      .maybeSingle();

    // Get user's recent activities for safety calibration
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - 90);
    
    const { data: activities } = await supabase
      .from("all_activities")
      .select("activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,activity_type")
      .eq("user_id", plan.user_id)
      .gte("activity_date", sinceDate.toISOString().slice(0, 10))
      .order("activity_date", { ascending: false });

    // Safety Calibrator (same as in generate-training-plan)
    class SafetyCalibrator {
      private runs: any[];
      private profile: any;
      
      constructor(runs: any[], profile: any) {
        this.runs = runs;
        this.profile = profile;
      }
      
      private getValidRunData() {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        
        return this.runs.filter((run: any) => {
          const pace = Number(run.pace_min_per_km);
          const distance = Number(run.total_distance_meters || 0) / 1000;
          const duration = Number(run.total_time_minutes || 0);
          const activityDate = new Date(run.activity_date);
          
          return (
            pace > 0 && pace < 12 &&
            distance >= 2 && distance <= 50 &&
            duration >= 10 &&
            activityDate >= cutoffDate &&
            Number.isFinite(pace) &&
            Number.isFinite(distance) &&
            Number.isFinite(duration)
          );
        });
      }
      
      private calculateSafeBaselines() {
        const validRuns = this.getValidRunData();
        
        if (validRuns.length < 3) {
          return this.getConservativeDefaults();
        }
        
        const paces = validRuns.map((r: any) => Number(r.pace_min_per_km)).sort((a, b) => a - b);
        const median = paces[Math.floor(paces.length / 2)];
        const p75 = paces[Math.floor(paces.length * 0.75)];
        
        const safeBasePace = median;
        const base5kTimeMin = safeBasePace * 5;
        
        const riegel = (baseTimeMin: number, baseDistKm: number, targetDistKm: number) => {
          return baseTimeMin * Math.pow(targetDistKm / baseDistKm, 1.06);
        };
        
        return {
          pace_5k: safeBasePace,
          pace_10k: riegel(base5kTimeMin, 5, 10) / 10,
          pace_half_marathon: riegel(base5kTimeMin, 5, 21.0975) / 21.0975,
          pace_easy: Math.max(safeBasePace * 1.4, p75),
          pace_tempo: riegel(base5kTimeMin, 5, 10) / 10,
        };
      }
      
      private getConservativeDefaults() {
        const age = this.profile?.birth_date ? 
          Math.floor((Date.now() - new Date(this.profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 35;
        
        const basePace = age < 25 ? 5.5 : age < 35 ? 6.0 : age < 45 ? 6.5 : 7.0;
        
        return {
          pace_5k: basePace,
          pace_10k: basePace * 1.08,
          pace_half_marathon: basePace * 1.15,
          pace_easy: basePace * 1.5,
          pace_tempo: basePace * 1.08,
        };
      }
      
      public getSafeTargetPaces() {
        return this.calculateSafeBaselines();
      }
      
      public applySafetyClamps(type: string, pace: number, duration?: number): { pace: number; warnings: string[] } {
        const baselines = this.calculateSafeBaselines();
        const warnings: string[] = [];
        let safePace = pace;
        
        switch (type.toLowerCase()) {
          case 'easy':
          case 'recovery':
          case 'base':
            const minEasyPace = Math.max(baselines.pace_10k + 0.45, baselines.pace_easy);
            if (pace < minEasyPace) {
              safePace = minEasyPace;
              warnings.push(`🚨 CRITICAL SAFETY: Easy pace ${pace.toFixed(2)} was DANGEROUS - adjusted to ${safePace.toFixed(2)}`);
            }
            break;
            
          case 'long_run':
          case 'long':
            const minLongPace = Math.max(baselines.pace_10k + 0.30, baselines.pace_easy);
            if (pace < minLongPace) {
              safePace = minLongPace;
              warnings.push(`🚨 CRITICAL SAFETY: Long run pace ${pace.toFixed(2)} was DANGEROUS - adjusted to ${safePace.toFixed(2)}`);
            }
            break;
            
          case 'tempo':
          case 'threshold':
            const minTempoPace = baselines.pace_10k;
            const maxTempoDuration = 45;
            
            if (pace < minTempoPace) {
              safePace = minTempoPace;
              warnings.push(`🚨 CRITICAL SAFETY: Tempo pace ${pace.toFixed(2)} was DANGEROUS - adjusted to ${safePace.toFixed(2)}`);
            }
            
            if (duration && duration > maxTempoDuration) {
              warnings.push(`🚨 CRITICAL SAFETY: Tempo duration ${duration}min was DANGEROUS - exceeds safe limit`);
            }
            break;
        }
        
        if (safePace < 3.0) {
          safePace = 3.0;
          warnings.push(`🚨 EMERGENCY OVERRIDE: Pace was life-threatening (<3:00/km) - set to emergency minimum`);
        }
        
        return { pace: safePace, warnings };
      }
    }

    const runs = (activities || []).filter((a) => (a.activity_type || "").toLowerCase().includes("run"));
    const safetyCalibrator = new SafetyCalibrator(runs, profile);
    const safeTargetPaces = safetyCalibrator.getSafeTargetPaces();

    console.log(`🛡️ Safe paces calculated for ${profile?.email}:`, safeTargetPaces);

    // Get current dangerous workouts
    const { data: currentWorkouts } = await supabase
      .from("training_plan_workouts")
      .select("*")
      .eq("plan_id", targetPlanId)
      .order("week_number", { ascending: true });

    if (!currentWorkouts?.length) {
      throw new Error("No workouts found for this plan");
    }

    // Apply safety recalibration to each workout
    const recalibratedWorkouts: any[] = [];
    let criticalIssuesFound = 0;

    for (const workout of currentWorkouts) {
      const originalPace = parseFloat(workout.target_pace_min_per_km);
      
      if (isNaN(originalPace)) {
        recalibratedWorkouts.push(workout);
        continue;
      }

      const { pace: safePace, warnings } = safetyCalibrator.applySafetyClamps(
        workout.workout_type,
        originalPace,
        workout.duration_minutes
      );

      if (warnings.length > 0) {
        criticalIssuesFound++;
        console.log(`🚨 CRITICAL ISSUE FIXED - ${workout.title}:`, warnings);
      }

      // Special adjustments for specific workout types
      let adjustedDuration = workout.duration_minutes;
      let adjustedDescription = workout.description;

      if (workout.workout_type === 'tempo' && workout.duration_minutes > 30) {
        adjustedDuration = Math.min(30, workout.duration_minutes);
        adjustedDescription = workout.description?.replace(/\d+min/, `${adjustedDuration}min`);
        console.log(`⚠️ Tempo duration reduced from ${workout.duration_minutes} to ${adjustedDuration}min for safety`);
      }

      recalibratedWorkouts.push({
        ...workout,
        target_pace_min_per_km: safePace.toFixed(2),
        duration_minutes: adjustedDuration,
        description: adjustedDescription,
        safety_recalibrated: true,
        original_pace: originalPace !== safePace ? originalPace.toFixed(2) : undefined,
        safety_warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    // Update workouts in database
    const updatePromises = recalibratedWorkouts.map(workout => 
      supabase
        .from("training_plan_workouts")
        .update({
          target_pace_min_per_km: workout.target_pace_min_per_km,
          duration_minutes: workout.duration_minutes,
          description: workout.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workout.id)
    );

    await Promise.all(updatePromises);

    // Log the recalibration
    await supabase
      .from("training_plans")
      .update({
        notes: `🛡️ SAFETY RECALIBRATED on ${new Date().toISOString()} - ${criticalIssuesFound} critical issues fixed`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetPlanId);

    console.log(`✅ SAFETY RECALIBRATION COMPLETE - ${criticalIssuesFound} critical issues fixed for ${profile?.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: targetPlanId,
        user_email: profile?.email,
        critical_issues_fixed: criticalIssuesFound,
        total_workouts_processed: recalibratedWorkouts.length,
        safe_target_paces: safeTargetPaces,
        message: `🛡️ CRITICAL SAFETY ISSUES RESOLVED - ${criticalIssuesFound} dangerous workouts fixed`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("🚨 RECALIBRATION ERROR:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        critical_safety_note: "If this function fails, DO NOT allow users to train with potentially dangerous paces"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});