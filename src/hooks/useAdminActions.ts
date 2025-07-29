import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useAdminActions = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const renewExpiredTokens = async (userId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-token-renewal', {
        body: userId ? { user_id: userId } : {}
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Renovação de Tokens",
        description: `Processo de renovação concluído: ${data?.summary || 'Verificar logs para detalhes'}`,
      });

      return data;
    } catch (error) {
      console.error('Error renewing tokens:', error);
      toast({
        title: "Erro na Renovação",
        description: "Falha ao renovar tokens expirados",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    renewExpiredTokens,
    loading
  };
};