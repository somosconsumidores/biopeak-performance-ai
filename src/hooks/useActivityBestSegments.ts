import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BestSegment {
  id: string;
  user_id: string;
  activity_id: string;
  activity_date: string | null;
  best_1km_pace_min_km: number | null;
  segment_start_distance_meters: number | null;
  segment_end_distance_meters: number | null;
  segment_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface CalculationResult {
  success: boolean;
  best_segment: BestSegment | null;
  message: string;
  error?: string;
}

export function useActivityBestSegments() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [segments, setSegments] = useState<BestSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const calculateBestSegment = async (activityId: string, userId: string): Promise<boolean> => {
    setIsCalculating(true);
    
    try {
      console.log('🔄 Calculating best 1km segment for activity:', activityId);
      
      const { data, error } = await supabase.functions.invoke('calculate-best-1km-segments', {
        body: {
          activity_id: activityId,
          user_id: userId
        }
      });

      if (error) {
        console.error('❌ Error calculating best segment:', error);
        toast({
          title: "Erro no Cálculo",
          description: "Erro ao calcular melhor segmento de 1km",
          variant: "destructive"
        });
        return false;
      }

      const result = data as CalculationResult;
      
      if (!result.success) {
        console.error('❌ Calculation failed:', result.error);
        toast({
          title: "Cálculo Falhou", 
          description: result.error || "Erro desconhecido",
          variant: "destructive"
        });
        return false;
      }

      if (result.best_segment) {
        toast({
          title: "Segmento Calculado!",
          description: result.message,
          variant: "default"
        });
        console.log('✅ Best segment calculated:', result.best_segment);
      } else {
        toast({
          title: "Análise Concluída",
          description: result.message,
          variant: "default"
        });
        console.log('ℹ️ No valid segment found:', result.message);
      }

      return true;

    } catch (error: any) {
      console.error('❌ Unexpected error:', error);
      toast({
        title: "Erro Inesperado",
        description: "Erro ao processar solicitação",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  const fetchUserSegments = async (userId: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('activity_best_segments')
        .select('*')
        .eq('user_id', userId)
        .order('activity_date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching segments:', error);
        toast({
          title: "Erro ao Carregar",
          description: "Erro ao carregar segmentos calculados",
          variant: "destructive"
        });
        return;
      }

      setSegments(data || []);
      console.log(`✅ Loaded ${data?.length || 0} calculated segments`);

    } catch (error: any) {
      console.error('❌ Unexpected error fetching segments:', error);
      toast({
        title: "Erro Inesperado",
        description: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSegmentByActivity = (activityId: string): BestSegment | null => {
    return segments.find(segment => segment.activity_id === activityId) || null;
  };

  const formatPace = (paceMinKm: number | null): string => {
    if (!paceMinKm) return 'N/A';
    
    const minutes = Math.floor(paceMinKm);
    const seconds = Math.round((paceMinKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
  };

  const formatDuration = (durationSeconds: number | null): string => {
    if (!durationSeconds) return 'N/A';
    
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.round(durationSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    // State
    isCalculating,
    isLoading,
    segments,
    
    // Actions
    calculateBestSegment,
    fetchUserSegments,
    getSegmentByActivity,
    
    // Utilities
    formatPace,
    formatDuration
  };
}