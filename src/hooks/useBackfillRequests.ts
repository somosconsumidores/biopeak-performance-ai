
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackfillRequest {
  id: string;
  request_type: string;
  time_range_start: number;
  time_range_end: number;
  status: 'triggered' | 'in_progress' | 'completed' | 'failed';
  triggered_at: string;
  completed_at?: string;
  activities_received: number;
  activity_details_received: number;
  webhook_notifications: any[];
  error_message?: string;
}

export const useBackfillRequests = () => {
  const [requests, setRequests] = useState<BackfillRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchBackfillRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('garmin_backfill_requests')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching backfill requests:', error);
        toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível carregar o histórico de backfill.",
          variant: "destructive",
        });
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error('Unexpected error fetching backfill requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToBackfillUpdates = () => {
    const subscription = supabase
      .channel('backfill-requests-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'garmin_backfill_requests'
        },
        (payload) => {
          console.log('Backfill request update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setRequests(prev => [payload.new as BackfillRequest, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => 
              prev.map(req => 
                req.id === payload.new.id ? payload.new as BackfillRequest : req
              )
            );
            
            // Show toast for completed requests
            const newRequest = payload.new as BackfillRequest;
            if (newRequest.status === 'completed' && payload.old.status !== 'completed') {
              toast({
                title: "Backfill concluído",
                description: `${newRequest.activity_details_received} detalhes de atividades recebidos via webhook.`,
                variant: "default",
              });
            }
          }
        }
      )
      .subscribe();

    return subscription;
  };

  useEffect(() => {
    fetchBackfillRequests();
    const subscription = subscribeToBackfillUpdates();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const getActiveRequests = () => {
    return requests.filter(req => req.status === 'triggered' || req.status === 'in_progress');
  };

  const getCompletedRequests = () => {
    return requests.filter(req => req.status === 'completed');
  };

  const getFailedRequests = () => {
    return requests.filter(req => req.status === 'failed');
  };

  const formatTimeRange = (startTime: number, endTime: number) => {
    const start = new Date(startTime * 1000).toLocaleDateString('pt-BR');
    const end = new Date(endTime * 1000).toLocaleDateString('pt-BR');
    return `${start} - ${end}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'triggered':
      case 'in_progress':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'triggered':
        return 'Acionado';
      case 'in_progress':
        return 'Em progresso';
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      default:
        return status;
    }
  };

  return {
    requests,
    isLoading,
    fetchBackfillRequests,
    getActiveRequests,
    getCompletedRequests,
    getFailedRequests,
    formatTimeRange,
    getStatusBadgeVariant,
    getStatusText
  };
};
