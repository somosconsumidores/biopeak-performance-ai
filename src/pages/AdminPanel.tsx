import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { AdminRoute } from '@/components/AdminRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminActions } from '@/hooks/useAdminActions';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Users, Key, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TokenStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
}

export const AdminPanel = () => {
  const { renewExpiredTokens, loading } = useAdminActions();
  const { toast } = useToast();
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchTokenStats = async () => {
    setRefreshing(true);
    try {
      const { data: tokens, error } = await supabase
        .from('garmin_tokens')
        .select('expires_at, is_active');

      if (error) throw error;

      const now = new Date();
      const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const stats = tokens.reduce((acc, token) => {
        acc.total++;
        if (token.is_active) acc.active++;
        
        if (token.expires_at) {
          const expiresAt = new Date(token.expires_at);
          if (expiresAt < now) {
            acc.expired++;
          } else if (expiresAt < soonThreshold) {
            acc.expiringSoon++;
          }
        }
        
        return acc;
      }, { total: 0, active: 0, expired: 0, expiringSoon: 0 });

      setTokenStats(stats);
    } catch (error) {
      console.error('Error fetching token stats:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar estatísticas dos tokens",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokenStats();
  }, []);

  const handleRenewTokens = async () => {
    try {
      await renewExpiredTokens();
      await fetchTokenStats(); // Refresh stats after renewal
    } catch (error) {
      // Error is already handled in useAdminActions
    }
  };

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
            <Button 
              onClick={fetchTokenStats} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Tokens</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tokenStats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{tokenStats.active}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens Expirados</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{tokenStats.expired}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expirando em 7 dias</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{tokenStats.expiringSoon}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Administrativas</CardTitle>
              <CardDescription>
                Gerencie tokens e execute operações de manutenção do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleRenewTokens}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Renovando...' : 'Renovar Tokens Expirados'}
                </Button>
                
                {tokenStats.expired > 0 && (
                  <Badge variant="destructive">
                    {tokenStats.expired} token(s) expirado(s)
                  </Badge>
                )}
                
                {tokenStats.expiringSoon > 0 && (
                  <Badge variant="secondary">
                    {tokenStats.expiringSoon} token(s) expirando em breve
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};