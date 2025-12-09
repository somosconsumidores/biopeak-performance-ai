import { useAuth } from '@/hooks/useAuth';
import { useAdminDashboardStats } from '@/hooks/useAdminDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Activity, 
  CreditCard, 
  Phone, 
  Target, 
  Calendar,
  Loader2,
  ShieldAlert,
  Watch,
  Footprints
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ADMIN_EMAIL = 'admin@biopeak.com';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { stats, loading, error } = useAdminDashboardStats();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
            <p className="text-center text-muted-foreground">
              Acesso negado. Este dashboard é restrito ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">{error || 'Erro ao carregar dados'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    color = 'text-primary' 
  }: { 
    title: string; 
    value: number | string; 
    subtitle?: string; 
    icon: any; 
    color?: string;
  }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full bg-muted ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const DonutChart = ({ 
    data, 
    title 
  }: { 
    data: { label: string; value: number }[]; 
    title: string;
  }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, 'Usuários']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  layout="vertical" 
                  align="right" 
                  verticalAlign="middle"
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Sem dados
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-1">Visão geral do BioPeak</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Total de Usuários" 
            value={stats.totalUsers.toLocaleString()} 
            icon={Users}
            color="text-blue-500"
          />
          <StatCard 
            title="Tokens Ativos" 
            value={stats.usersWithActiveTokens.toLocaleString()}
            subtitle={`Garmin: ${stats.tokenBreakdown.garmin} | Polar: ${stats.tokenBreakdown.polar} | Strava: ${stats.tokenBreakdown.strava}`}
            icon={Watch}
            color="text-emerald-500"
          />
          <StatCard 
            title="Usuários com Atividades" 
            value={stats.usersWithActivities.toLocaleString()}
            icon={Activity}
            color="text-orange-500"
          />
          <StatCard 
            title="Assinantes Ativos" 
            value={stats.activeSubscribers.toLocaleString()}
            icon={CreditCard}
            color="text-purple-500"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Com Telefone" 
            value={stats.usersWithPhone.toLocaleString()}
            subtitle={stats.totalUsers > 0 ? `${((stats.usersWithPhone / stats.totalUsers) * 100).toFixed(1)}% do total` : ''}
            icon={Phone}
            color="text-cyan-500"
          />
          <StatCard 
            title="Planos de Treino Ativos" 
            value={stats.usersWithActivePlan.toLocaleString()}
            icon={Target}
            color="text-pink-500"
          />
          <StatCard 
            title="Idade Média (Todos)" 
            value={stats.avgAgeAll ? `${stats.avgAgeAll} anos` : 'N/A'}
            icon={Calendar}
            color="text-amber-500"
          />
          <StatCard 
            title="Idade Média (Assinantes)" 
            value={stats.avgAgeSubscribers ? `${stats.avgAgeSubscribers} anos` : 'N/A'}
            icon={Calendar}
            color="text-indigo-500"
          />
        </div>

        {/* Activity Sources Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Footprints className="h-5 w-5" />
              Usuários por Fonte de Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {stats.usersByActivitySource.map(({ source, count }) => (
                <div key={source} className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{source.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Charts */}
        <h2 className="text-xl font-semibold mb-4">Distribuição do Onboarding</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DonutChart 
            data={stats.onboardingDistribution.goal} 
            title="Objetivo Principal"
          />
          <DonutChart 
            data={stats.onboardingDistribution.athleticLevel} 
            title="Nível Atlético"
          />
          <DonutChart 
            data={stats.onboardingDistribution.aplicativo} 
            title="Aplicativo Utilizado (Top 10)"
          />
        </div>
      </div>
    </div>
  );
}