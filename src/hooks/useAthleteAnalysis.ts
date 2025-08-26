import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInYears, getISOWeek } from "date-fns";

export type AthleteLevel = "Beginner" | "Intermediate" | "Advanced" | "Elite";

export interface RaceEstimates {
  k5?: { seconds: number; formatted: string };
  k10?: { seconds: number; formatted: string };
  k21?: { seconds: number; formatted: string };
  k42?: { seconds: number; formatted: string };
}

export interface TrainingPatterns {
  avgWeeklyFrequency?: number;
  avgWeeklyDistanceKm?: number;
  recentWeeksSampled: number;
}

export interface AthleteStatsSummary {
  avgPaceMinPerKm?: number;
  bestPaceMinPerKm?: number;
  avgHr?: number;
  observedMaxHr?: number;
}

export interface AthleteAnalysisResult {
  loading: boolean;
  error?: string;
  level?: AthleteLevel;
  raceEstimates: RaceEstimates;
  patterns: TrainingPatterns;
  stats: AthleteStatsSummary;
  suggestedMaxHr?: number;
  refresh: () => Promise<void>;
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function riegel(tBaseSec: number, dBaseKm: number, targetKm: number, exp = 1.06) {
  // T2 = T1 * (D2/D1)^1.06
  return tBaseSec * Math.pow(targetKm / dBaseKm, exp);
}

export function useAthleteAnalysis(daysLookback: number = 180): AthleteAnalysisResult {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [level, setLevel] = useState<AthleteLevel | undefined>();
  const [race, setRace] = useState<RaceEstimates>({});
  const [patterns, setPatterns] = useState<TrainingPatterns>({ recentWeeksSampled: 0 });
  const [stats, setStats] = useState<AthleteStatsSummary>({});
  const [suggestedMaxHr, setSuggestedMaxHr] = useState<number | undefined>();

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(undefined);
    try {
      const since = new Date();
      since.setDate(since.getDate() - daysLookback);
      const sinceStr = since.toISOString().split("T")[0];

      // Fetch running activities from unified table
      const { data: activities, error: actErr } = await supabase
        .from("all_activities")
        .select(
          "activity_date,total_distance_meters,total_time_minutes,pace_min_per_km,average_heart_rate,max_heart_rate,activity_type"
        )
        .eq("user_id", user.id)
        .gte("activity_date", sinceStr)
        .order("activity_date", { ascending: false });

      if (actErr) throw actErr;

      // Filter to running-like activities
      const runs = (activities || []).filter((a) =>
        (a.activity_type || "").toLowerCase().includes("run")
      );

      // Compute sustained pace with distance/time thresholds and anomaly filtering
      const isPaceValid = (p: number) => Number.isFinite(p) && p >= 2.5 && p <= 12;
      const runsWithMetrics = runs.map((r) => ({
        dist: Number(r.total_distance_meters || 0),
        timeMin: Number(r.total_time_minutes || 0),
        pace: Number(r.pace_min_per_km),
      }));

      const candidates5k = runsWithMetrics.filter((r) => r.dist >= 5000 && r.timeMin >= 10 && isPaceValid(r.pace));
      const candidates3k = runsWithMetrics.filter((r) => r.dist >= 3000 && r.timeMin >= 8 && isPaceValid(r.pace));
      const candidates1_5k = runsWithMetrics.filter((r) => r.dist >= 1500 && r.timeMin >= 8 && isPaceValid(r.pace));
      const pickBestPace = (arr: typeof runsWithMetrics) => (arr.length ? Math.min(...arr.map((a) => a.pace)) : undefined);

      const sustainedBestPace =
        pickBestPace(candidates5k) ?? pickBestPace(candidates3k) ?? pickBestPace(candidates1_5k);

      const validPaces = runsWithMetrics.map((r) => r.pace).filter(isPaceValid);
      const avgPace = validPaces.length ? validPaces.reduce((s, v) => s + v, 0) / validPaces.length : undefined;

      const top3 = [...validPaces].sort((a, b) => a - b).slice(0, 3);
      const bestPace =
        sustainedBestPace ?? (top3.length ? top3[Math.floor((top3.length - 1) / 2)] : undefined);

      const hrVals = runs
        .map((r) => Number(r.average_heart_rate))
        .filter((v) => Number.isFinite(v) && v > 0);
      const avgHr = hrVals.length ? Math.round(hrVals.reduce((s, v) => s + v, 0) / hrVals.length) : undefined;

      const maxHrVals = runs
        .map((r) => Number(r.max_heart_rate))
        .filter((v) => Number.isFinite(v) && v > 0);
      const observedMaxHr = maxHrVals.length ? Math.max(...maxHrVals) : undefined;

      setStats({ avgPaceMinPerKm: avgPace, bestPaceMinPerKm: bestPace, avgHr, observedMaxHr });

      // Weekly patterns (last up to 8 weeks)
      const byWeek = new Map<string, { count: number; distance: number }>();
      runs.forEach((r) => {
        const d = new Date(r.activity_date as string);
        const year = d.getUTCFullYear();
        const week = getISOWeek(d); // 1..53
        const key = `${year}-W${String(week).padStart(2, "0")}`;
        const prev = byWeek.get(key) || { count: 0, distance: 0 };
        byWeek.set(key, {
          count: prev.count + 1,
          distance: prev.distance + Number(r.total_distance_meters || 0),
        });
      });

      const lastWeeks = Array.from(byWeek.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 8)
        .map(([, v]) => v);

      const avgWeeklyFrequency = lastWeeks.length
        ? Number((lastWeeks.reduce((s, v) => s + v.count, 0) / lastWeeks.length).toFixed(2))
        : 0;
      const avgWeeklyDistanceKm = lastWeeks.length
        ? Number(((lastWeeks.reduce((s, v) => s + v.distance, 0) / lastWeeks.length) / 1000).toFixed(1))
        : 0;
      setPatterns({ avgWeeklyFrequency, avgWeeklyDistanceKm, recentWeeksSampled: lastWeeks.length });

      // Race estimates
      const basePace = bestPace ?? avgPace; // min/km
      let base5kTimeSec: number | undefined;
      if (basePace && basePace > 0) {
        base5kTimeSec = basePace * 5 * 60; // pace * distance (km) * 60
      } else if (runs.length) {
        // fallback from best activity with enough distance
        const candidate = runs
          .filter((r) => Number(r.total_distance_meters || 0) >= 4000)
          .map((r) => Number(r.total_time_minutes || 0) * 60)
          .filter((v) => Number.isFinite(v) && v > 0)
          .sort((a, b) => a - b)[0];
        if (candidate) base5kTimeSec = candidate * (5 / (Number(runs[0].total_distance_meters || 5000) / 1000));
      }

      if (base5kTimeSec && Number.isFinite(base5kTimeSec)) {
        const k5 = Math.round(base5kTimeSec);
        const k10 = Math.round(riegel(base5kTimeSec, 5, 10));
        const k21 = Math.round(riegel(base5kTimeSec, 5, 21.097));
        const k42 = Math.round(riegel(base5kTimeSec, 5, 42.195));
        setRace({
          k5: { seconds: k5, formatted: formatHMS(k5) },
          k10: { seconds: k10, formatted: formatHMS(k10) },
          k21: { seconds: k21, formatted: formatHMS(k21) },
          k42: { seconds: k42, formatted: formatHMS(k42) },
        });
      } else {
        setRace({});
      }

      // Athlete level classification via Edge Function (unsupervised) with fallback
      try {
        const { data: levelRes, error: levelErr } = await supabase.functions.invoke(
          'compute-athlete-level',
          { body: { user_id: user.id, lookback_days: 56 } }
        );
        if (levelErr) throw levelErr;
        if (levelRes?.level) {
          setLevel(levelRes.level as AthleteLevel);
        } else {
          throw new Error('No level returned');
        }
      } catch (_) {
        const fiveK = base5kTimeSec;
        let computedLevel: AthleteLevel = "Beginner";
        if ((avgWeeklyDistanceKm || 0) >= 70 || (fiveK || 999999) < 18 * 60) {
          computedLevel = "Elite";
        } else if ((avgWeeklyDistanceKm || 0) >= 40 || (avgWeeklyFrequency || 0) >= 4 || (fiveK || 999999) < 22 * 60) {
          computedLevel = "Advanced";
        } else if ((avgWeeklyDistanceKm || 0) >= 15 || (avgWeeklyFrequency || 0) >= 3) {
          computedLevel = "Intermediate";
        } else {
          computedLevel = "Beginner";
        }
        setLevel(computedLevel);
      }

      // Suggested Max HR: Tanaka 208 - 0.7*age, adjusted by observed
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("birth_date")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profErr) throw profErr;

      let age: number | undefined;
      if (profile?.birth_date) {
        const dob = new Date(profile.birth_date as string);
        age = differenceInYears(new Date(), dob);
      }

      let estMax = age ? Math.round(208 - 0.7 * age) : undefined; // Tanaka formula
      if (observedMaxHr) {
        // Never suggest below observed peak
        estMax = estMax ? Math.max(estMax, observedMaxHr) : observedMaxHr;
      }
      setSuggestedMaxHr(estMax);
    } catch (e: any) {
      console.error("useAthleteAnalysis error", e);
      setError(e?.message || "Falha ao analisar atleta");
    } finally {
      setLoading(false);
    }
  }, [user, daysLookback]);

  useEffect(() => {
    if (!authLoading && user) {
      refresh();
    } else if (!user && !authLoading) {
      setLoading(false);
      setError("Usuário não autenticado");
    }
  }, [authLoading, user, refresh]);

  return useMemo(
    () => ({ loading, error, level, raceEstimates: race, patterns, stats, suggestedMaxHr, refresh }),
    [loading, error, level, race, patterns, stats, suggestedMaxHr, refresh]
  );
}
