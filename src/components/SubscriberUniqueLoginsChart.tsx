import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LoginData {
  login_date: string;
  users: number;
}

export function SubscriberUniqueLoginsChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriber-unique-logins-chart'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unique_logins_by_date_subscribers');
      if (error) throw error;
      return data as LoginData[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logins Únicos de Assinantes (60 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logins Únicos de Assinantes (60 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.map(item => ({
    date: format(parseISO(item.login_date), 'dd/MM', { locale: ptBR }),
    users: Number(item.users),
  })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logins Únicos de Assinantes (60 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              interval={6}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => [value, 'Assinantes']}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
