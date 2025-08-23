import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface ACDRow {
  id: string;
  activity_id: string;
  processed_at: string;
  total_distance_meters: number | null;
  duration_seconds: number | null;
  avg_pace_min_km: number | null;
  avg_heart_rate: number | null;
  series_data: Array<{ distance_m?: number | null; pace_min_km?: number | null; heart_rate?: number | null }>
}

export const AdminActivityChartPreview = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ACDRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_chart_data')
        .select('id, activity_id, processed_at, total_distance_meters, duration_seconds, avg_pace_min_km, avg_heart_rate, series_data')
        .order('processed_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        setActivities(data as any);
        if (data.length > 0) setSelectedId(data[0].id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const current = useMemo(() => activities.find(a => a.id === selectedId) || null, [activities, selectedId]);

  const chartData = useMemo(() => {
    if (!current) return [] as any[];
    return (current.series_data || []).map((p) => ({
      distance_km: (p.distance_m ?? 0) / 1000,
      pace_min_per_km: p.pace_min_km ?? null,
      heart_rate: p.heart_rate ?? null,
    }));
  }, [current]);

  const avgHr = useMemo(() => {
    const vals = chartData.map(d => d.heart_rate).filter((x: any) => typeof x === 'number');
    if (!vals.length) return null; return vals.reduce((a: number,b: number)=>a+b,0)/vals.length;
  }, [chartData]);
  const avgPace = useMemo(() => {
    const vals = chartData.map(d => d.pace_min_per_km).filter((x: any) => typeof x === 'number' && isFinite(x) && x>0);
    if (!vals.length) return null; return vals.reduce((a: number,b: number)=>a+b,0)/vals.length;
  }, [chartData]);

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pré-visualização do Gráfico (activity_chart_data)</span>
          {current && (
            <Badge variant="outline">Atividade {current.activity_id}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="w-64">
            <Select value={selectedId || ''} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione uma atividade'} />
              </SelectTrigger>
              <SelectContent>
                {activities.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.activity_id} · {new Date(a.processed_at).toLocaleString()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="distance_km" type="number" domain={[0, 'dataMax']} tickFormatter={(v)=>`${v.toFixed(1)}km`} />
              <YAxis yAxisId="pace" dataKey="pace_min_per_km" domain={['dataMin - 0.2', 'dataMax + 0.2']} tickFormatter={(value) => {
                if (value == null) return '';
                const m = Math.floor(value); const s = Math.round((value-m)*60); return `${m}:${s.toString().padStart(2,'0')}`;
              }} stroke="hsl(var(--primary))" />
              <YAxis yAxisId="hr" orientation="right" domain={['dataMin - 10', 'dataMax + 10']} stroke="hsl(var(--secondary))" />
              <Tooltip formatter={(val: any, name: any) => {
                if (name === 'pace_min_per_km') {
                  const m = Math.floor(val); const s = Math.round((val-m)*60); return [`${m}:${s.toString().padStart(2,'0')}/km`, 'Ritmo'];
                }
                if (name === 'heart_rate') return [`${Math.round(val)} bpm`, 'FC'];
                return [val, name];
              }} />
              {avgPace && <ReferenceLine yAxisId="pace" y={avgPace} stroke="hsl(var(--primary))" strokeDasharray="5 5" />}
              {avgHr && <ReferenceLine yAxisId="hr" y={avgHr} stroke="hsl(var(--secondary))" strokeDasharray="5 5" />}
              <Line yAxisId="pace" type="monotone" dataKey="pace_min_per_km" stroke="hsl(var(--primary))" dot={false} />
              <Line yAxisId="hr" type="monotone" dataKey="heart_rate" stroke="hsl(var(--secondary))" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
