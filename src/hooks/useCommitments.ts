import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type Commitment = Tables<'user_commitments'>;

export const useCommitments = () => {
  const { user } = useAuth();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCommitments = async () => {
    try {
      setLoading(true);
      
      // Use user from context instead of API call
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('user_commitments')
        .select('*')
        .eq('is_active', true)
        .order('applied_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setCommitments(data || []);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar compromissos:', err);
      setError('Falha ao carregar compromissos');
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (recommendation: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category?: string;
  }) => {
    try {
      // Use user from context instead of API call
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Você precisa estar logado para aplicar recomendações',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error: insertError } = await supabase
        .from('user_commitments')
        .insert({
          user_id: user.id,
          title: recommendation.title,
          description: recommendation.description,
          priority: recommendation.priority,
          category: recommendation.category || 'Recomendação IA',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setCommitments(prev => [data, ...prev]);
      
      toast({
        title: 'Compromisso Assumido',
        description: 'Recomendação aplicada com sucesso! Acompanhe seu progresso no dashboard.',
      });

      return true;
    } catch (err) {
      console.error('Erro ao aplicar recomendação:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao aplicar recomendação. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const markAsCompleted = async (commitmentId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('user_commitments')
        .update({ 
          completed_at: new Date().toISOString(),
          is_active: false 
        })
        .eq('id', commitmentId);

      if (updateError) {
        throw updateError;
      }

      setCommitments(prev => 
        prev.filter(commitment => commitment.id !== commitmentId)
      );

      toast({
        title: 'Compromisso Concluído',
        description: 'Parabéns! Continue assim para alcançar seus objetivos.',
      });

      return true;
    } catch (err) {
      console.error('Erro ao marcar como concluído:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao marcar como concluído. Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchCommitments();
    }
  }, [user]);

  return {
    commitments,
    loading,
    error,
    applyRecommendation,
    markAsCompleted,
    refetch: fetchCommitments,
  };
};
