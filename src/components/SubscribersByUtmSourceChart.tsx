import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface UtmData {
  utm_source: string;
  subscribers_count: number;
}

export function SubscribersByUtmSourceChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscribers-by-utm-source'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_subscribers_by_utm_source');
      if (error) throw error;
      return data as UtmData[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assinantes por UTM Source</CardTitle>
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
          <CardTitle>Assinantes por UTM Source</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.map(item => ({
    source: item.utm_source || 'Direto',
    count: Number(item.subscribers_count),
  })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinantes por UTM Source</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              dataKey="source" 
              type="category"
              tick={{ fontSize: 12 }}
              width={120}
            />
            <Tooltip 
              formatter={(value: number) => [value, 'Assinantes']}
              labelFormatter={(label) => `Fonte: ${label}`}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
