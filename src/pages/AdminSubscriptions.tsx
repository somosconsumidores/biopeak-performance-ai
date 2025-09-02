import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2, Search, RefreshCw } from 'lucide-react';

export const AdminSubscriptions = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [email, setEmail] = useState('sandro.leao@biopeak-ai.com');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const { toast } = useToast();
  const [activeSubscribersCount, setActiveSubscribersCount] = useState<number | null>(null);

  const forceSubscriptionCheck = async () => {
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('force-subscription-check', {
        body: { email: email.trim() }
      });

      if (error) {
        throw error;
      }

      setResult(data);
      
      if (data.success) {
        toast({
          title: "Verificação concluída",
          description: `Status: ${data.subscribed ? 'Assinante ativo' : 'Não assinante'}`,
        });
        loadSubscribers(); // Refresh the list
      } else {
        toast({
          title: "Erro na verificação",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao forçar verificação:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar verificação de assinatura",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const loadSubscribers = async () => {
    setLoadingSubscribers(true);
    try {
      const [listRes, countRes] = await Promise.all([
        supabase
          .from('subscribers')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('subscribers')
          .select('user_id', { head: true, count: 'exact' })
          .not('stripe_customer_id', 'is', null),
      ]);

      if (listRes.error) throw listRes.error;
      if (countRes.error) throw countRes.error;

      setSubscribers(listRes.data || []);
      setActiveSubscribersCount(countRes.count ?? 0);
    } catch (error) {
      console.error('Erro ao carregar assinantes:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar lista de assinantes",
        variant: "destructive",
      });
    } finally {
      setLoadingSubscribers(false);
    }
  };

  useEffect(() => {
    loadSubscribers();
  }, []);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-destructive">Acesso negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Administração de Assinaturas</h1>
        
        {/* Stats */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Assinantes Ativos</h2>
          <div className="text-3xl font-bold flex items-center gap-2">
            {loadingSubscribers ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              activeSubscribersCount ?? 0
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Usuários únicos com stripe_customer_id definido</p>
        </Card>

        {/* Force Subscription Check */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Verificar Assinatura Manualmente</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Email do usuário:</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <Button onClick={forceSubscriptionCheck} disabled={isChecking}>
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Verificar Assinatura
            </Button>
          </div>
          
          {result && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Resultado da Verificação:</h3>
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Subscribers List */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Lista de Assinantes</h2>
            <Button onClick={loadSubscribers} disabled={loadingSubscribers} variant="outline" size="sm">
              {loadingSubscribers ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
          </div>
          
          {loadingSubscribers ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Email</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Plano</th>
                    <th className="text-left p-2">Vencimento</th>
                    <th className="text-left p-2">Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-sm">{sub.email}</td>
                      <td className="p-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          sub.subscribed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {sub.subscribed ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-2">{sub.subscription_type || '-'}</td>
                      <td className="p-2">{sub.subscription_tier || '-'}</td>
                      <td className="p-2">
                        {sub.subscription_end 
                          ? new Date(sub.subscription_end).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </td>
                      <td className="p-2">
                        {new Date(sub.updated_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {subscribers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-muted-foreground">
                        Nenhum assinante encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};