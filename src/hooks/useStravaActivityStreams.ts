import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StravaStreamData {
  data: number[] | number[][];
  type: string;
  series_type: string;
  original_size: number;
}

interface StravaActivityStreams {
  id: string;
  user_id: string;
  strava_activity_id: number;
  latlng?: any;
  heartrate?: any;
  velocity_smooth?: any;
  cadence?: any;
  watts?: any;
  distance?: any;
  time?: any;
  grade_smooth?: any;
  temp?: any;
  moving?: any;
  created_at: string;
  updated_at: string;
}

interface UseStravaActivityStreamsReturn {
  fetchStreams: (activityId: number) => Promise<StravaActivityStreams | null>;
  getStreams: (activityId: number) => Promise<StravaActivityStreams | null>;
  isLoading: boolean;
  error: string | null;
}

export const useStravaActivityStreams = (): UseStravaActivityStreamsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStreams = async (activityId: number): Promise<StravaActivityStreams | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching streams for activity:', activityId);
      
      const { data, error } = await supabase.functions.invoke('strava-activity-streams', {
        body: { activity_id: activityId }
      });

      if (error) {
        console.error('Error fetching streams:', error);
        throw new Error(error.message || 'Failed to fetch activity streams');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch activity streams');
      }

      toast({
        title: 'Streams carregados',
        description: 'Detalhes da atividade foram carregados com sucesso',
      });

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: 'Erro ao carregar streams',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getStreams = async (activityId: number): Promise<StravaActivityStreams | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // First try to get from database
      const { data: existingStreams, error: dbError } = await supabase
        .from('strava_activity_details')
        .select('*')
        .eq('strava_activity_id', activityId)
        .single();

      if (dbError && dbError.code !== 'PGRST116') {
        throw dbError;
      }

      if (existingStreams) {
        console.log('Found existing streams in database');
        return existingStreams as StravaActivityStreams;
      }

      // If not found in database, fetch from Strava API
      console.log('Streams not found in database, fetching from Strava API');
      return await fetchStreams(activityId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      
      toast({
        title: 'Erro ao obter streams',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchStreams,
    getStreams,
    isLoading,
    error,
  };
};