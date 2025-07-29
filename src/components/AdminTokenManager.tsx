import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Settings } from 'lucide-react';

interface TokenManagerState {
  isLoading: boolean;
  lastAction: string | null;
  results: any;
  cronStatus: any[];
  healthData: any;
}

export const AdminTokenManager = () => {
  const [state, setState] = useState<TokenManagerState>({
    isLoading: false,
    lastAction: null,
    results: null,
    cronStatus: [],
    healthData: null
  });
  const { toast } = useToast();

  const executeAction = async (action: string, description: string) => {
    setState(prev => ({ ...prev, isLoading: true, lastAction: action }));
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-token-management', {
        body: { action }
      });

      if (error) {
        console.error(`[AdminTokenManager] Error executing ${action}:`, error);
        toast({
          title: "Erro na execução",
          description: `Falha ao executar ${description}: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log(`[AdminTokenManager] ${action} results:`, data);
      
      setState(prev => ({
        ...prev,
        results: data.results,
        cronStatus: data.cron_status || prev.cronStatus,
        healthData: action === 'health_check' ? data.results : prev.healthData
      }));

      toast({
        title: "Ação executada",
        description: data.message || `${description} executado com sucesso`,
        variant: "default"
      });

    } catch (error) {
      console.error(`[AdminTokenManager] Error:`, error);
      toast({
        title: "Erro inesperado",
        description: `Erro ao executar ${description}`,
        variant: "destructive"
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const getHealthBadgeVariant = (count: number) => {
    if (count === 0) return 'default';
    if (count < 5) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Administração de Tokens Garmin
          </CardTitle>
          <CardDescription>
            Controle e monitoramento do sistema de renovação automática de tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => executeAction('force_renew_expired', 'renovação forçada')}
              disabled={state.isLoading}
              variant="outline"
              className="h-auto p-4"
            >
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className={`h-5 w-5 ${state.isLoading && state.lastAction === 'force_renew_expired' ? 'animate-spin' : ''}`} />
                <span>Renovar Tokens Expirados</span>
              </div>
            </Button>

            <Button
              onClick={() => executeAction('health_check', 'verificação de saúde')}
              disabled={state.isLoading}
              variant="outline"
              className="h-auto p-4"
            >
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${state.isLoading && state.lastAction === 'health_check' ? 'animate-spin' : ''}`} />
                <span>Verificar Saúde</span>
              </div>
            </Button>

            <Button
              onClick={() => executeAction('full_system_check', 'verificação completa')}
              disabled={state.isLoading}
              variant="default"
              className="h-auto p-4"
            >
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${state.isLoading && state.lastAction === 'full_system_check' ? 'animate-spin' : ''}`} />
                <span>Reparo Completo</span>
              </div>
            </Button>
          </div>

          {/* Advanced Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => executeAction('check_cron_status', 'status dos cron jobs')}
              disabled={state.isLoading}
              variant="secondary"
              size="sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              Status Cron Jobs
            </Button>

            <Button
              onClick={() => executeAction('trigger_proactive_renewal', 'renovação proativa')}
              disabled={state.isLoading}
              variant="secondary"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Trigger Renovação
            </Button>

            <Button
              onClick={() => executeAction('process_orphaned_webhooks', 'processamento de webhooks')}
              disabled={state.isLoading}
              variant="secondary"
              size="sm"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Processar Webhooks
            </Button>
          </div>

          {/* Health Status */}
          {state.healthData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Tokens Expirados:</span>
                  <Badge variant={getHealthBadgeVariant(state.healthData.expired_tokens)}>
                    {state.healthData.expired_tokens}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Webhooks Órfãos:</span>
                  <Badge variant={getHealthBadgeVariant(state.healthData.orphaned_webhooks)}>
                    {state.healthData.orphaned_webhooks}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Última verificação: {new Date(state.healthData.timestamp).toLocaleString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cron Jobs Status */}
          {state.cronStatus && state.cronStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status dos Cron Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {state.cronStatus.map((job, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{job.jobname}</span>
                        <div className="text-sm text-muted-foreground">{job.schedule}</div>
                      </div>
                      <Badge variant={job.active ? 'default' : 'destructive'}>
                        {job.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Results */}
          {state.results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Últimos Resultados</CardTitle>
                <CardDescription>
                  Ação: {state.lastAction}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-60">
                  {JSON.stringify(state.results, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

        </CardContent>
      </Card>
    </div>
  );
};