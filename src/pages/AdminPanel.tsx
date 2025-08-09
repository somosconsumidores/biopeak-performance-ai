import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { AdminRoute } from '@/components/AdminRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminActions } from '@/hooks/useAdminActions';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Users, Key, AlertTriangle, Activity, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRegistrationChart } from '@/components/UserRegistrationChart';

interface TokenStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
}

interface UserStats {
  totalUsers: number;
  usersWithValidTokens: number;
  usersWithActivities: number;
  totalActivities: number;
  usersWithCommitments: number;
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
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    usersWithValidTokens: 0,
    usersWithActivities: 0,
    totalActivities: 0,
    usersWithCommitments: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      // Fetch token stats
      const { data: tokens, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('expires_at, is_active');

      if (tokenError) throw tokenError;

      const now = new Date();
      const soonThreshold = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

      const tokenStats = tokens.reduce((acc, token) => {
        acc.total++;
        
        if (token.is_active) {
          acc.active++;
          
          // Only check expiration for active tokens
          if (token.expires_at) {
            const expiresAt = new Date(token.expires_at);
            if (expiresAt < now) {
              acc.expired++;
            } else if (expiresAt < soonThreshold) {
              acc.expiringSoon++;
            }
          }
        }
        
        return acc;
      }, { total: 0, active: 0, expired: 0, expiringSoon: 0 });

      setTokenStats(tokenStats);

      // Fetch user stats with proper distinct counts
      const [
        { count: totalUsers, error: usersError },
        { data: validTokensData, error: validTokensError },
        { data: activitiesUsersData, error: activitiesUsersError },
        { count: totalActivities, error: totalActivitiesError },
        { data: commitmentsData, error: commitmentsError }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('garmin_tokens').select('user_id').eq('is_active', true),
        supabase.from('garmin_activities').select('user_id'),
        supabase.from('garmin_activities').select('*', { count: 'exact', head: true }),
        supabase.from('user_commitments').select('user_id')
      ]);

      if (usersError || validTokensError || activitiesUsersError || totalActivitiesError || commitmentsError) {
        throw new Error('Erro ao buscar estatísticas dos usuários');
      }

      // Calculate unique users from the data
      const uniqueValidTokenUsers = validTokensData ? new Set(validTokensData.map(item => item.user_id)).size : 0;
      const uniqueActivityUsers = activitiesUsersData ? new Set(activitiesUsersData.map(item => item.user_id)).size : 0;
      const uniqueCommitmentUsers = commitmentsData ? new Set(commitmentsData.map(item => item.user_id)).size : 0;

      setUserStats({
        totalUsers: totalUsers || 0,
        usersWithValidTokens: uniqueValidTokenUsers,
        usersWithActivities: uniqueActivityUsers,
        totalActivities: totalActivities || 0,
        usersWithCommitments: uniqueCommitmentUsers
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar estatísticas",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRenewTokens = async () => {
    try {
      await renewExpiredTokens();
      await fetchStats(); // Refresh stats after renewal
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
              onClick={fetchStats} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Token Stats Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Estatísticas de Tokens</h2>
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
                  <CardTitle className="text-sm font-medium">Tokens a expirar em 4 horas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{tokenStats.expiringSoon}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* User Stats Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Estatísticas de Usuários</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userStats.totalUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com Token Válido</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{userStats.usersWithValidTokens}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com Atividades</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{userStats.usersWithActivities}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Atividades</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userStats.totalActivities}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com Compromissos</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{userStats.usersWithCommitments}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* User Registration Chart */}
          <UserRegistrationChart />

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

          {/* Polar Webhook Recovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recuperação de Atividades Polar
              </CardTitle>
              <CardDescription>
                Recuperar detalhes de atividades Polar a partir dos webhooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Esta função processa webhooks de exercícios Polar que foram recebidos mas não processados,
                  recuperando os dados completos das atividades e armazenando nos detalhes.
                </p>
                <Button
                  onClick={async () => {
                    try {
                      setRefreshing(true);
                      const response = await supabase.functions.invoke('recover-polar-webhook-activities');
                      
                      if (response.error) {
                        throw response.error;
                      }

                      const result = response.data;
                      toast({
                        title: "Recuperação concluída",
                        description: `${result.processed_count} atividades processadas, ${result.error_count} erros`,
                      });
                      
                      if (result.errors && result.errors.length > 0) {
                        console.error('Recovery errors:', result.errors);
                      }
                      
                      await fetchStats();
                    } catch (error) {
                      console.error('Recovery error:', error);
                      toast({
                        title: "Erro na recuperação",
                        description: error.message || "Erro desconhecido",
                        variant: "destructive",
                      });
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  disabled={refreshing}
                  className="w-full"
                >
                  {refreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Recuperar Atividades Polar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};