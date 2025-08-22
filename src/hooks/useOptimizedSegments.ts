import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface SegmentData {
  segment: string;
  segmentNumber: number;
  avgPace: number | null;
  avgHeartRate: number | null;
  distance: number;
}

export const useOptimizedSegments = (activityId: string | null) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAdminRoute = window.location.pathname.startsWith('/admin');

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

      // First get the activity source from all_activities table  
      const { data: activityData } = await supabase
        .from('all_activities')
        .select('activity_source, user_id')
        .eq('activity_id', id)
        .then(result => isAdminRoute ? result : { ...result, data: result.data?.filter(d => d.user_id === user.id) })
        .then(result => ({ ...result, data: result.data?.[0] || null }));

      const activitySource = activityData?.activity_source || 'garmin';
      const activityOwnerId = activityData?.user_id || user.id;
      console.log('Activity source detected:', activitySource, 'Owner:', activityOwnerId);

      // Buscar dados otimizados da tabela activity_segments
      const { data: segmentData, error: segmentError } = await supabase
        .from('activity_segments')
        .select('*')
        .eq('user_id', activityOwnerId)
        .eq('activity_id', id)
        .eq('activity_source', activitySource)
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
          const etlFunction = isAdminRoute && isAdmin ? 'admin-trigger-etl' : 'process-activity-data-etl';
          const etlBody = isAdminRoute && isAdmin 
            ? { activity_id: id, activity_source: activitySource }
            : { user_id: activityOwnerId, activity_id: id, activity_source: activitySource };
          
          const { error: etlError } = await supabase.functions.invoke(etlFunction, { body: etlBody });

          if (etlError) {
            console.error('ETL processing error:', etlError);
            setError('Erro ao processar dados da atividade');
            return;
          }

          // Tentar buscar novamente após ETL
          const { data: newSegmentData } = await supabase
            .from('activity_segments')
            .select('*')
            .eq('user_id', activityOwnerId)
            .eq('activity_id', id)
            .eq('activity_source', activitySource)
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