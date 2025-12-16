import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useUniqueLoginsChart } from '@/hooks/useUniqueLoginsChart';
import { Users, Loader2 } from 'lucide-react';

export const UserUniqueLoginsChart = () => {
  const { data, loading, error } = useUniqueLoginsChart();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários únicos por dia (logins)
          </CardTitle>
          <CardDescription>
            Evolução dos últimos 60 dias
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários únicos por dia (logins)
          </CardTitle>
          <CardDescription>
            Evolução dos últimos 60 dias
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.users, 0);
  const avg = data.length > 0 ? Math.round(total / data.length) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuários únicos por dia (logins)
        </CardTitle>
        <CardDescription>
          Evolução dos últimos 60 dias — Total: {total.toLocaleString()} | Média: {avg}/dia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                className="text-muted-foreground"
                interval={Math.floor(data.length / 10)}
                fontSize={11}
              />
              <YAxis className="text-muted-foreground" fontSize={11} />
              <Tooltip 
                labelFormatter={(value) => `Data: ${formatDate(value as string)}`}
                formatter={(value) => [value as number, 'Usuários únicos']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="users" 
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
