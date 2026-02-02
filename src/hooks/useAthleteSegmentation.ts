import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AthleteSegmentation {
  id: string;
  user_id: string;
  segment_name: string;
  badge_icon: string;
  badge_color: string;
  ai_explanation: string;
  metrics_snapshot: {
    weekly_distance_km?: number;
    weekly_frequency?: number;
    avg_pace_min_km?: number;
    pace_improvement_percent?: number;
    distance_improvement_percent?: number;
    vo2_max?: number | null;
    personal_records_count?: number;
    training_plan_adherence_percent?: number | null;
  };
  composite_score: number | null;
  trend: "up" | "down" | "stable";
  analysis_period_start: string | null;
  analysis_period_end: string | null;
  segmentation_date: string;
  created_at: string;
}

export function useAthleteSegmentation() {
  return useQuery({
    queryKey: ["athlete-segmentation"],
    queryFn: async (): Promise<AthleteSegmentation | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from("athlete_segmentation")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching athlete segmentation:", error);
        throw error;
      }

      return data as AthleteSegmentation | null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export function useAthleteSegmentationHistory(limit = 10) {
  return useQuery({
    queryKey: ["athlete-segmentation-history", limit],
    queryFn: async (): Promise<AthleteSegmentation[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("athlete_segmentation")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching athlete segmentation history:", error);
        throw error;
      }

      return (data || []) as AthleteSegmentation[];
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
