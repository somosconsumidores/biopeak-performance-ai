import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { AdminRoute } from '@/components/AdminRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAdminActions } from '@/hooks/useAdminActions';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Users, Key, AlertTriangle, Activity, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRegistrationChart } from '@/components/UserRegistrationChart';
import { UserUniqueLoginsChart } from '@/components/UserUniqueLoginsChart';
import { SurveyManagement } from '@/components/SurveyManagement';
import { VariationBackfillSection } from '@/components/VariationBackfillSection';
import { AdminActivityChartPreview } from '@/components/AdminActivityChartPreview';
import { ActivitySegmentChart1km } from '@/components/ActivitySegmentChart1km';
import { ActivityVariationAnalysis } from '@/components/ActivityVariationAnalysis';
import { PerformanceIndicatorsFromChart } from '@/components/PerformanceIndicatorsFromChart';

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

interface ProviderStats {
  polarTokenUsers: number;
  polarActivityUsers: number;
  stravaTokenUsers: number;
  stravaActivityUsers: number;
}

interface TopUser {
  email: string;
  user_id: string;
  login_days: number;
}

export const AdminPanel = () => {
  const { renewExpiredTokens, loading } = useAdminActions();
  const { toast } = useToast();
  const [reprocessingVO2Max, setReprocessingVO2Max] = useState(false);
  const [reprocessingGarminDetails, setReprocessingGarminDetails] = useState(false);
  const [reprocessingSpecificActivity, setReprocessingSpecificActivity] = useState(false);
  const [specificActivityId, setSpecificActivityId] = useState('');
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
  const [providerStats, setProviderStats] = useState<ProviderStats>({
    polarTokenUsers: 0,
    polarActivityUsers: 0,
    stravaTokenUsers: 0,
    stravaActivityUsers: 0
  });
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [webhookLogId, setWebhookLogId] = useState('');
  const [activityUserId, setActivityUserId] = useState('');
  const [chartProcessing, setChartProcessing] = useState(false);
  const [recentCharts, setRecentCharts] = useState<any[]>([]);
  const [segmentTestActivityId, setSegmentTestActivityId] = useState('');

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
        { data: commitmentsData, error: commitmentsError },
        { data: providerData, error: providerError },
        { data: topUsersData, error: topUsersError }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('garmin_tokens').select('user_id').eq('is_active', true),
        supabase.from('garmin_activities').select('user_id'),
        supabase.from('garmin_activities').select('*', { count: 'exact', head: true }),
        supabase.from('user_commitments').select('user_id'),
        supabase.rpc('get_provider_user_stats'),
        supabase.rpc('get_top_login_users', { limit_count: 10 })
      ]);

      if (usersError || validTokensError || activitiesUsersError || totalActivitiesError || commitmentsError || providerError || topUsersError) {
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

      if (providerData && providerData.length > 0) {
        const p = providerData[0];
        setProviderStats({
          polarTokenUsers: p.users_with_polar_tokens || 0,
          polarActivityUsers: p.users_with_polar_activities || 0,
          stravaTokenUsers: p.users_with_strava_tokens || 0,
          stravaActivityUsers: p.users_with_strava_activities || 0,
        });
      }

      // Set top users data
      if (topUsersData) {
        setTopUsers(topUsersData);
      }

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

  const handleReprocessVO2Max = async () => {
    setReprocessingVO2Max(true);
    try {
      const { data, error } = await supabase.rpc('reprocess_all_user_metrics_vo2max');
      
      if (error) {
        throw error;
      }

      const result = data[0];
      toast({
        title: "Reprocessamento VO2Max Concluído",
        description: `${result.processed_logs} logs processados, ${result.inserted_rows} linhas inseridas, ${result.updated_rows} linhas atualizadas`,
      });

      await fetchStats(); // Refresh stats after reprocessing
    } catch (error) {
      console.error('Error reprocessing VO2Max:', error);
      toast({
        title: "Erro no Reprocessamento",
        description: "Falha ao reprocessar dados de VO2Max",
        variant: "destructive",
      });
    } finally {
      setReprocessingVO2Max(false);
    }
  };

  const handleReprocessGarminDetailsErrorsToday = async () => {
    setReprocessingGarminDetails(true);
    try {
      const today = new Date().toISOString().slice(0,10);
      const { data, error } = await supabase.functions.invoke('reprocess-garmin-details-errors-today', {
        body: { date: today },
      });
      if (error) throw error;
      const result: any = data || {};
      toast({
        title: "Reprocessamento de detalhes (Garmin)",
        description: `Processados: ${result.processed || result.successful || 0} / Falhas: ${result.errors?.length || result.failed || 0}`,
      });
      await fetchStats();
    } catch (error: any) {
      console.error('Error reprocessing Garmin details errors today:', error);
      toast({
        title: "Erro no reprocessamento (Garmin)",
        description: error.message || "Falha ao reprocessar erros de hoje",
        variant: "destructive",
      });
    } finally {
      setReprocessingGarminDetails(false);
    }
  };

  const handleReprocessSpecificActivity = async () => {
    if (!specificActivityId) return;
    
    setReprocessingSpecificActivity(true);
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-garmin-details-errors-today', {
        body: { activity_id: specificActivityId },
      });
      if (error) throw error;
      const result: any = data || {};
      
      if (result.success) {
        toast({
          title: "Atividade reprocessada",
          description: `Atividade ${specificActivityId} foi reprocessada com sucesso`,
        });
        setSpecificActivityId('');
      } else {
        throw new Error(result.error || 'Falha no reprocessamento');
      }
      
      await fetchStats();
    } catch (error: any) {
      console.error('Error reprocessing specific activity:', error);
      toast({
        title: "Erro no reprocessamento",
        description: error.message || "Falha ao reprocessar atividade específica",
        variant: "destructive",
      });
    } finally {
      setReprocessingSpecificActivity(false);
    }
  };

  const handleProcessActivityChart = async () => {
    if (!webhookLogId && !(activityUserId && specificActivityId)) {
      toast({ title: "Dados insuficientes", description: "Informe webhook_log_id ou (user_id e activity_id).", variant: "destructive" });
      return;
    }
    setChartProcessing(true);
    try {
      const body: any = webhookLogId ? { webhook_log_id: webhookLogId, full_precision: true } : { user_id: activityUserId, activity_id: specificActivityId, full_precision: true };
      const { data, error } = await supabase.functions.invoke('process-activity-chart-from-garmin-log', { body });
      if (error) throw error;
      const res: any = data || {};
      if (!res.success) throw new Error(res.error || 'Falha no processamento');
      toast({ title: "Gráfico processado", description: `Pontos: ${res.inserted} • Fonte: ${res.source || 'desconhecida'}` });
      const uid = res.user_id || activityUserId;
      if (uid) {
        const { data: charts } = await supabase
          .from('activity_chart_data')
          .select('activity_id, data_points_count, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(3);
        setRecentCharts(charts || []);
      }
    } catch (err: any) {
      console.error('process-activity-chart error:', err);
      toast({ title: "Erro", description: err.message || 'Falha ao processar', variant: "destructive" });
    } finally {
      setChartProcessing(false);
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

          {/* Conexões por Provedor */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Conexões por Provedor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com token Polar</CardTitle>
                  <Key className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.polarTokenUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com atividade Polar</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.polarActivityUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com token Strava</CardTitle>
                  <Key className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.stravaTokenUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Usuários com atividades Strava</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providerStats.stravaActivityUsers}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráfico de Registros de Usuários */}
          <UserRegistrationChart />

          {/* Logins Únicos por Dia */}
          <UserUniqueLoginsChart />

          {/* Preview do gráfico de atividade gerado do JSON (para validação) */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Pré-visualização do Gráfico (JSON ➜ activity_chart_data)</h2>
            <AdminActivityChartPreview />
          </div>

          {/* Teste do gráfico de segmentos baseado em activity_chart_data */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Teste de Gráfico por Segmentos (activity_chart_data)</h2>
            <Card>
              <CardHeader>
                <CardTitle>Testar Análise por Segmentos (1km)</CardTitle>
                <CardDescription>
                  Digite o activity_id para testar o novo componente baseado em activity_chart_data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="activity_id (ex: 20162761971)"
                    value={segmentTestActivityId}
                    onChange={(e) => setSegmentTestActivityId(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => setSegmentTestActivityId('')}
                    variant="outline"
                    disabled={!segmentTestActivityId}
                  >
                    Limpar
                  </Button>
                </div>
                {segmentTestActivityId && (
                  <ActivitySegmentChart1km activityId={segmentTestActivityId} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Teste de Análise de Variação baseado em activity_chart_data */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Teste de Análise de Variação (activity_chart_data)</h2>
            <Card>
              <CardHeader>
                <CardTitle>Análise de Coeficiente de Variação</CardTitle>
                <CardDescription>
                  Reproduz a análise de variação do /workout usando dados de activity_chart_data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityVariationAnalysis />
              </CardContent>
            </Card>
          </div>

          {/* Teste de Indicadores de Performance baseado em activity_chart_data */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Teste de Indicadores de Performance (activity_chart_data)</h2>
            <Card>
              <CardHeader>
                <CardTitle>Indicadores de Performance</CardTitle>
                <CardDescription>
                  Reproduz os indicadores de performance do /workout usando dados de activity_chart_data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceIndicatorsFromChart />
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Usuários Mais Ativos */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Usuários Mais Ativos</CardTitle>
              <CardDescription>
                Usuários com mais dias de login na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topUsers.map((user, index) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={index < 3 ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.login_days} {user.login_days === 1 ? 'dia' : 'dias'} de login
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{user.login_days}</p>
                      <p className="text-xs text-muted-foreground">dias</p>
                    </div>
                  </div>
                ))}
                {topUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum usuário encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Survey Management */}
          <SurveyManagement />

          {/* Processar gráfico (Garmin) manualmente */}
          <Card>
            <CardHeader>
              <CardTitle>Processar gráfico (Garmin) manualmente</CardTitle>
              <CardDescription>Acione a função process-activity-chart-from-garmin-log via webhook_log_id ou (user_id + activity_id)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="webhook_log_id" value={webhookLogId} onChange={(e) => setWebhookLogId(e.target.value)} />
                <Input placeholder="user_id" value={activityUserId} onChange={(e) => setActivityUserId(e.target.value)} />
                <Input placeholder="activity_id" value={specificActivityId} onChange={(e) => setSpecificActivityId(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleProcessActivityChart} disabled={chartProcessing} className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${chartProcessing ? 'animate-spin' : ''}`} />
                  {chartProcessing ? 'Processando...' : 'Processar gráfico (Garmin)'}
                </Button>
              </div>

              {recentCharts.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-sm font-medium mb-2">Últimos gráficos deste usuário</h4>
                  <div className="space-y-2">
                    {recentCharts.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div className="text-sm">Atividade {c.activity_id}</div>
                        <div className="text-xs text-muted-foreground">{c.data_points_count} pontos • {new Date(c.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                
                <Button 
                  onClick={handleReprocessVO2Max}
                  disabled={reprocessingVO2Max}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Activity className={`h-4 w-4 ${reprocessingVO2Max ? 'animate-spin' : ''}`} />
                  {reprocessingVO2Max ? 'Reprocessando...' : 'Reprocessar VO2Max'}
                </Button>

                <Button
                  onClick={handleReprocessGarminDetailsErrorsToday}
                  disabled={reprocessingGarminDetails}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Activity className={`h-4 w-4 ${reprocessingGarminDetails ? 'animate-spin' : ''}`} />
                  {reprocessingGarminDetails ? 'Reprocessando...' : 'Reprocessar erros de hoje (Garmin Detalhes)'}
                </Button>

                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="ID da atividade"
                    value={specificActivityId}
                    onChange={(e) => setSpecificActivityId(e.target.value)}
                    className="w-40"
                  />
                  <Button
                    onClick={handleReprocessSpecificActivity}
                    disabled={reprocessingSpecificActivity || !specificActivityId}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Activity className={`h-4 w-4 ${reprocessingSpecificActivity ? 'animate-spin' : ''}`} />
                    {reprocessingSpecificActivity ? 'Reprocessando...' : 'Reprocessar atividade'}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!specificActivityId) return;
                      setReprocessingSpecificActivity(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('reprocess-garmin-details-errors-today', {
                          body: { activity_id: specificActivityId, use_webhook_payload: true, batch_size: 200 },
                        });
                        if (error) throw error;
                        const result: any = data || {};
                        if (result.success) {
                          toast({
                            title: "Atividade reprocessada (payload)",
                            description: `Atividade ${specificActivityId} processada via payload do webhook`,
                          });
                          setSpecificActivityId('');
                        } else {
                          throw new Error(result.error || 'Falha no reprocessamento');
                        }
                        await fetchStats();
                      } catch (err: any) {
                        console.error('Error reprocessing via payload:', err);
                        toast({
                          title: "Erro no reprocessamento (payload)",
                          description: err.message || "Falha ao reprocessar via payload",
                          variant: "destructive",
                        });
                      } finally {
                        setReprocessingSpecificActivity(false);
                      }
                    }}
                    disabled={reprocessingSpecificActivity || !specificActivityId}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Activity className={`h-4 w-4 ${reprocessingSpecificActivity ? 'animate-spin' : ''}`} />
                    {reprocessingSpecificActivity ? 'Reprocessando...' : 'Reprocessar via payload'}
                  </Button>
                </div>
                
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

          <VariationBackfillSection />

          {/* Polar Webhook Recovery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recuperação de Atividades Polar
              </CardTitle>
              <CardDescription>
                Recuperar detalhes de atividades Polar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recuperar de Webhooks</h4>
                    <p className="text-sm text-muted-foreground">
                      Processa webhooks recebidos mas não processados, criando novas atividades.
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
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      {refreshing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Recuperar de Webhooks'
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recuperar Detalhes</h4>
                    <p className="text-sm text-muted-foreground">
                      Busca detalhes para atividades existentes que não possuem dados detalhados.
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          setRefreshing(true);
                          const response = await supabase.functions.invoke('recover-polar-activity-details');
                          
                          if (response.error) {
                            throw response.error;
                          }

                          const result = response.data;
                          toast({
                            title: "Recuperação de detalhes concluída",
                            description: `${result.processed_count} atividades processadas, ${result.error_count} erros`,
                          });
                          
                          if (result.errors && result.errors.length > 0) {
                            console.error('Details recovery errors:', result.errors);
                          }
                          
                          await fetchStats();
                        } catch (error) {
                          console.error('Details recovery error:', error);
                          toast({
                            title: "Erro na recuperação de detalhes",
                            description: error.message || "Erro desconhecido",
                            variant: "destructive",
                          });
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      disabled={refreshing}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    >
                      {refreshing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Recuperar Detalhes'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};