import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WebhookRecoveryOptions {
  webhook_id?: string;
  user_id?: string;
  hours_back?: number;
  webhook_type?: 'activity_notification' | 'activity_details_notification';
  dry_run?: boolean;
}

interface WebhookRecoveryResult {
  message: string;
  failed_webhooks_found: number;
  reprocessed_successfully: number;
  reprocessed_with_errors: number;
  dry_run: boolean;
  failed_webhooks?: Array<{
    id: string;
    user_id: string;
    webhook_type: string;
    created_at: string;
  }>;
  reprocess_results?: Array<{
    webhook_id: string;
    success: boolean;
    error?: string;
  }>;
}

export const useWebhookRecovery = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<WebhookRecoveryResult | null>(null);
  const { toast } = useToast();

  const checkFailedWebhooks = async (options: WebhookRecoveryOptions = {}): Promise<WebhookRecoveryResult | null> => {
    setIsLoading(true);
    setLastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para verificar webhooks.",
          variant: "destructive",
        });
        return null;
      }

      console.log('[useWebhookRecovery] Checking failed webhooks with options:', options);
      
      const { data, error } = await supabase.functions.invoke('reprocess-failed-webhooks', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          dry_run: true, // Always do dry run first for checking
          ...options
        }
      });

      if (error) {
        console.error('[useWebhookRecovery] Function error:', error);
        toast({
          title: "Erro na verificação",
          description: "Falha ao verificar webhooks. Tente novamente.",
          variant: "destructive",
        });
        return null;
      }

      const result = data as WebhookRecoveryResult;
      setLastResult(result);
      
      toast({
        title: "Verificação concluída",
        description: `Encontrados ${result.failed_webhooks_found} webhooks com dados perdidos.`,
        variant: result.failed_webhooks_found > 0 ? "destructive" : "default",
      });

      console.log('[useWebhookRecovery] Check completed:', result);
      return result;

    } catch (error) {
      console.error('[useWebhookRecovery] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a verificação.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reprocessFailedWebhooks = async (options: WebhookRecoveryOptions = {}): Promise<WebhookRecoveryResult | null> => {
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para reprocessar webhooks.",
          variant: "destructive",
        });
        return null;
      }

      console.log('[useWebhookRecovery] Reprocessing failed webhooks with options:', options);
      
      const { data, error } = await supabase.functions.invoke('reprocess-failed-webhooks', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          dry_run: false, // Actually reprocess
          ...options
        }
      });

      if (error) {
        console.error('[useWebhookRecovery] Function error:', error);
        toast({
          title: "Erro no reprocessamento",
          description: "Falha ao reprocessar webhooks. Tente novamente.",
          variant: "destructive",
        });
        return null;
      }

      const result = data as WebhookRecoveryResult;
      setLastResult(result);
      
      toast({
        title: "Reprocessamento concluído",
        description: `${result.reprocessed_successfully} webhooks reprocessados com sucesso. ${result.reprocessed_with_errors} com erro.`,
        variant: result.reprocessed_with_errors > 0 ? "default" : "default",
      });

      console.log('[useWebhookRecovery] Reprocessing completed:', result);
      return result;

    } catch (error) {
      console.error('[useWebhookRecovery] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante o reprocessamento.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reprocessSpecificWebhook = async (webhookId: string): Promise<boolean> => {
    const result = await reprocessFailedWebhooks({ webhook_id: webhookId });
    return result?.reprocessed_successfully === 1;
  };

  const reprocessUserWebhooks = async (userId?: string, hoursBack: number = 24): Promise<WebhookRecoveryResult | null> => {
    return await reprocessFailedWebhooks({ 
      user_id: userId, 
      hours_back: hoursBack 
    });
  };

  return {
    checkFailedWebhooks,
    reprocessFailedWebhooks,
    reprocessSpecificWebhook,
    reprocessUserWebhooks,
    isLoading,
    lastResult,
  };
};