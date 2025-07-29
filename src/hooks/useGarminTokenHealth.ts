import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TokenHealthStats {
  timestamp: string;
  tokens: {
    total: number;
    active: number;
    expired: number;
    expiring_soon: number;
    invalid_refresh: number;
  };
  webhooks: {
    today_total: number;
    today_no_active_user: number;
    today_recovered: number;
    pending_orphaned: number;
  };
  mappings: {
    total: number;
    active: number;
  };
}

interface TokenHealth {
  overall: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
}

interface TokenHealthResponse {
  success: boolean;
  health: TokenHealth;
  stats: TokenHealthStats;
  recovery: {
    last_7_days_recovered: number;
  };
  actions_available: string[];
}

export const useGarminTokenHealth = () => {
  const [healthData, setHealthData] = useState<TokenHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { toast } = useToast();

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('garmin-token-health-monitor');
      
      if (error) {
        console.error('[TokenHealth] Health check failed:', error);
        toast({
          title: "Erro na verificação de saúde",
          description: "Não foi possível verificar a saúde dos tokens Garmin",
          variant: "destructive"
        });
        return;
      }

      setHealthData(data);
      setLastChecked(new Date());
      
      // Show notification for critical issues
      if (data.health.overall === 'critical') {
        toast({
          title: "Problemas críticos detectados",
          description: `${data.health.issues.length} problemas críticos nos tokens Garmin`,
          variant: "destructive"
        });
      } else if (data.health.overall === 'warning') {
        toast({
          title: "Avisos detectados",
          description: `${data.health.issues.length} avisos nos tokens Garmin`,
          variant: "default"
        });
      }
      
    } catch (error) {
      console.error('[TokenHealth] Health check error:', error);
      toast({
        title: "Erro na verificação",
        description: "Erro inesperado ao verificar saúde dos tokens",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runProactiveRenewal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('proactive-token-renewal');
      
      if (error) {
        console.error('[TokenHealth] Proactive renewal failed:', error);
        toast({
          title: "Erro na renovação",
          description: "Falha na renovação proativa de tokens",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Renovação concluída",
        description: `${data.renewed} tokens renovados, ${data.failed} falhas`,
        variant: data.failed > 0 ? "default" : "default"
      });
      
      // Refresh health data
      await checkHealth();
      
    } catch (error) {
      console.error('[TokenHealth] Proactive renewal error:', error);
      toast({
        title: "Erro na renovação",
        description: "Erro inesperado durante renovação de tokens",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processOrphanedWebhooks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-orphaned-webhooks');
      
      if (error) {
        console.error('[TokenHealth] Orphaned webhook processing failed:', error);
        toast({
          title: "Erro no processamento",
          description: "Falha no processamento de webhooks órfãos",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Processamento concluído",
        description: `${data.reprocessed} webhooks reprocessados, ${data.failed} falhas`,
        variant: data.failed > 0 ? "default" : "default"
      });
      
      // Refresh health data
      await checkHealth();
      
    } catch (error) {
      console.error('[TokenHealth] Orphaned webhook processing error:', error);
      toast({
        title: "Erro no processamento",
        description: "Erro inesperado durante processamento de webhooks",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-check health on mount and periodically
  useEffect(() => {
    checkHealth();
    
    // Check every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    healthData,
    isLoading,
    lastChecked,
    checkHealth,
    runProactiveRenewal,
    processOrphanedWebhooks
  };
};