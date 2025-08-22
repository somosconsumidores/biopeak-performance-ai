import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SegmentData {
  segment: string;
  segmentNumber: number;
  avgPace: number | null;
  avgHeartRate: number | null;
  distance: number;
}

export const useOptimizedSegments = (activityId: string | null) => {
  const { user } = useAuth();
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmentData = useMemo(() => {
    return segments.map(segment => ({
      ...segment,
      segment: `${segment.segmentNumber}km`,
      distance: 1000 // Cada segmento é 1km
    }));
  }, [segments]);

  const fetchSegments = async (id: string) => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setSegments([]);

    try {
      console.log('Fetching optimized segments for activity:', id);

      // Buscar dados otimizados da tabela activity_segments
      const { data: segmentData, error: segmentError } = await supabase
        .from('activity_segments')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_id', id)
        .order('segment_number', { ascending: true });

      if (segmentError) {
        console.error('Error fetching segments:', segmentError);
        setError('Erro ao buscar segmentos da atividade');
        return;
      }

      if (!segmentData || segmentData.length === 0) {
        console.log('No optimized segments found, triggering ETL processing...');
        
        // Tentar processar via ETL
        try {
          const { error: etlError } = await supabase.functions.invoke('process-activity-data-etl', {
            body: { 
              user_id: user.id,
              activity_id: id,
              activity_source: 'garmin' // Default
            }
          });

          if (etlError) {
            console.error('ETL processing error:', etlError);
            setError('Erro ao processar dados da atividade');
            return;
          }

          // Tentar buscar novamente após ETL
          const { data: newSegmentData } = await supabase
            .from('activity_segments')
            .select('*')
            .eq('user_id', user.id)
            .eq('activity_id', id)
            .order('segment_number', { ascending: true });

          if (!newSegmentData || newSegmentData.length === 0) {
            setError('Dados de segmentos não disponíveis');
            return;
          }

          // Usar os novos dados
          buildSegments(newSegmentData);
        } catch (etlError) {
          console.error('Error in ETL processing:', etlError);
          setError('Erro ao processar dados da atividade');
        }
      } else {
        // Usar dados existentes
        buildSegments(segmentData);
      }

    } catch (error) {
      console.error('Error fetching segments:', error);
      setError('Erro ao buscar segmentos da atividade');
    } finally {
      setLoading(false);
    }
  };

  const buildSegments = (segmentData: any[]) => {
    const processedSegments: SegmentData[] = segmentData.map(segment => ({
      segment: `${segment.segment_number}km`,
      segmentNumber: segment.segment_number,
      avgPace: segment.avg_pace_min_km,
      avgHeartRate: segment.avg_heart_rate,
      distance: 1000 // Cada segmento é 1km
    }));

    setSegments(processedSegments);
  };

  useEffect(() => {
    if (user && activityId) {
      fetchSegments(activityId);
    }
  }, [user, activityId]);

  const refetch = () => {
    if (activityId) {
      fetchSegments(activityId);
    }
  };

  return { segmentData, loading, error, refetch };
};