import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, Heart, Activity } from 'lucide-react';

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
  const [showHrOnly, setShowHrOnly] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_chart_data')
        .select('id, activity_id, processed_at, total_distance_meters, duration_seconds, avg_pace_min_km, avg_heart_rate, series_data')
        .order('processed_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        setActivities(data as any);
        if (data.length > 0) setSelectedId(data[0].id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const filteredActivities = useMemo(() => {
    if (!showHrOnly) return activities;
    return activities.filter(a => {
      const hasHr = a.avg_heart_rate && a.avg_heart_rate > 0;
      const hasHrInSeries = a.series_data?.some(p => p.heart_rate && p.heart_rate > 0);
      return hasHr || hasHrInSeries;
    });
  }, [activities, showHrOnly]);

  const current = useMemo(() => filteredActivities.find(a => a.id === selectedId) || null, [filteredActivities, selectedId]);

  const chartData = useMemo(() => {
    if (!current) return [] as any[];
    const data = (current.series_data || []).map((p) => ({
      distance_km: (p.distance_m ?? 0) / 1000,
      pace_min_per_km: p.pace_min_km ?? null,
      heart_rate: p.heart_rate ?? null,
    }));
    
    // Debug log for heart rate data
    const hrPoints = data.filter(d => d.heart_rate && d.heart_rate > 0);
    console.log(`Activity ${current.activity_id}: ${hrPoints.length}/${data.length} points with HR data`);
    
    return data;
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
        <div className="flex gap-4 items-center flex-wrap">
          <div className="w-64">
            <Select value={selectedId || ''} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione uma atividade'} />
              </SelectTrigger>
              <SelectContent>
                {filteredActivities.map(a => {
                  const hasHr = a.avg_heart_rate && a.avg_heart_rate > 0;
                  const hasHrInSeries = a.series_data?.some(p => p.heart_rate && p.heart_rate > 0);
                  const hrIndicator = hasHr || hasHrInSeries ? '❤️' : '🏃';
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {hrIndicator} {a.activity_id} · {new Date(a.processed_at).toLocaleString()}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant={showHrOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHrOnly(!showHrOnly)}
            className="flex items-center gap-2"
          >
            <Heart className="h-4 w-4" />
            {showHrOnly ? 'Mostrar todas' : 'Apenas com FC'}
          </Button>
          
          {current && (
            <div className="flex gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {chartData.length} pontos
              </Badge>
              {avgHr && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  FC: {Math.round(avgHr)} bpm
                </Badge>
              )}
              {avgPace && (
                <Badge variant="secondary">
                  Ritmo: {Math.floor(avgPace)}:{Math.round((avgPace-Math.floor(avgPace))*60).toString().padStart(2,'0')}/km
                </Badge>
              )}
            </div>
          )}
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
              <YAxis yAxisId="hr" orientation="right" domain={['dataMin - 10', 'dataMax + 10']} stroke="hsl(var(--destructive))" />
              <Tooltip 
                formatter={(val: any, name: any) => {
                  if (name === 'pace_min_per_km') {
                    const m = Math.floor(val); const s = Math.round((val-m)*60); return [`${m}:${s.toString().padStart(2,'0')}/km`, 'Ritmo'];
                  }
                  if (name === 'heart_rate') return [`${Math.round(val)} bpm`, 'Frequência Cardíaca'];
                  return [val, name];
                }} 
                labelFormatter={(label) => `Distância: ${Number(label).toFixed(1)}km`}
              />
              {avgPace && <ReferenceLine yAxisId="pace" y={avgPace} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={`Ritmo médio: ${Math.floor(avgPace)}:${Math.round((avgPace-Math.floor(avgPace))*60).toString().padStart(2,'0')}/km`} />}
              {avgHr && <ReferenceLine yAxisId="hr" y={avgHr} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={`FC média: ${Math.round(avgHr)} bpm`} />}
              <Line 
                yAxisId="pace" 
                type="monotone" 
                dataKey="pace_min_per_km" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                dot={false} 
                connectNulls={false}
                name="Ritmo (min/km)" 
              />
              <Line 
                yAxisId="hr" 
                type="monotone" 
                dataKey="heart_rate" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2} 
                dot={false} 
                connectNulls={false}
                name="Frequência Cardíaca (bpm)" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
