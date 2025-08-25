import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Heart, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HeartRateZone {
  zone: string;
  label: string;
  minHR: number;
  maxHR: number;
  percentage: number;
  timeInZone: number;
  color: string;
}

interface HeartRateZonesFromChartProps {
  className?: string;
  activityId?: string | null;
}

export const HeartRateZonesFromChart = ({ className, activityId }: HeartRateZonesFromChartProps) => {
  const [maxHROverride, setMaxHROverride] = useState('');
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async (id: string) => {
    if (!id?.trim()) {
      setChartData(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_chart_data')
        .select('*')
        .eq('activity_id', id.trim())
        .single();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Atividade não encontrada",
          description: `Nenhuma atividade encontrada com ID: ${id}`,
          variant: "destructive"
        });
        setChartData(null);
        return;
      }

      setChartData(data);
      // Removed success toast for auto-loading
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  const zones = useMemo((): HeartRateZone[] => {
    if (!chartData?.series_data || !Array.isArray(chartData.series_data)) {
      return [];
    }

    const seriesData = chartData.series_data;
    
    // Extrair dados de frequência cardíaca
    const heartRateData: { hr: number; dt: number }[] = [];
    let totalTime = 0;

    seriesData.forEach((point: any, index: number) => {
      const hr = point.heart_rate || point.heartrate || point.hr;
      if (typeof hr === 'number' && hr > 0) {
        // Calcular duração do ponto (diferença entre pontos ou 1 segundo como fallback)
        let dt = 1;
        if (index < seriesData.length - 1) {
          const currentTime = point.elapsed_time_seconds || point.t || point.time || (index * 1);
          const nextTime = seriesData[index + 1].elapsed_time_seconds || 
                          seriesData[index + 1].t || 
                          seriesData[index + 1].time || 
                          ((index + 1) * 1);
          if (typeof currentTime === 'number' && typeof nextTime === 'number') {
            dt = Math.max(1, nextTime - currentTime);
          }
        }
        
        heartRateData.push({ hr, dt });
        totalTime += dt;
      }
    });

    if (heartRateData.length === 0) {
      return [];
    }

    // Calcular FCmax
    const dataMaxHR = Math.max(...heartRateData.map(d => d.hr));
    let maxHR = dataMaxHR;
    
    // Usar override se fornecido
    if (maxHROverride && !isNaN(Number(maxHROverride))) {
      maxHR = Number(maxHROverride);
    }

    // Definir zonas baseadas no useHeartRateZones
    const zoneDefinitions = [
      { zone: 'Zona 1', label: 'Recuperação', minPercent: 0,  maxPercent: 60,  color: 'bg-blue-500' },
      { zone: 'Zona 2', label: 'Aeróbica',    minPercent: 60, maxPercent: 70,  color: 'bg-green-500' },
      { zone: 'Zona 3', label: 'Limiar',      minPercent: 70, maxPercent: 80,  color: 'bg-yellow-500' },
      { zone: 'Zona 4', label: 'Anaeróbica',  minPercent: 80, maxPercent: 90,  color: 'bg-orange-500' },
      { zone: 'Zona 5', label: 'Máxima',      minPercent: 90, maxPercent: 150, color: 'bg-red-500' },
    ];

    return zoneDefinitions.map((zoneDef, index) => {
      const minHR = Math.round((zoneDef.minPercent / 100) * maxHR);
      const maxHR_zone = Math.round((zoneDef.maxPercent / 100) * maxHR);

      let secondsInZone = 0;
      heartRateData.forEach(({ hr, dt }) => {
        const inZone = index === zoneDefinitions.length - 1
          ? hr >= minHR
          : hr >= minHR && hr < maxHR_zone;
        if (inZone) secondsInZone += dt;
      });

      const percentage = totalTime > 0 ? (secondsInZone / totalTime) * 100 : 0;

      return {
        zone: zoneDef.zone,
        label: zoneDef.label,
        minHR,
        maxHR: maxHR_zone,
        percentage: Math.round(percentage * 10) / 10,
        timeInZone: secondsInZone,
        color: zoneDef.color,
      };
    });
  }, [chartData, maxHROverride]);

  const stats = useMemo(() => {
    if (!chartData?.series_data) return null;

    const seriesData = chartData.series_data;
    const heartRates = seriesData
      .map((point: any) => point.heart_rate || point.heartrate || point.hr)
      .filter((hr: any) => typeof hr === 'number' && hr > 0);

    if (heartRates.length === 0) return null;

    return {
      minHR: Math.min(...heartRates),
      maxHR: Math.max(...heartRates),
      avgHR: Math.round(heartRates.reduce((sum: number, hr: number) => sum + hr, 0) / heartRates.length),
      dataPoints: heartRates.length,
      totalPoints: seriesData.length,
    };
  }, [chartData, maxHROverride]);

  // Auto-fetch when activityId changes
  React.useEffect(() => {
    if (activityId) {
      fetchData(activityId);
    } else {
      setChartData(null);
    }
  }, [activityId]);

  if (!activityId) {
    return (
      <Card className={`glass-card border-glass-border ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Heart className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-xl font-semibold">Zonas de Frequência Cardíaca</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione uma atividade no preview acima para analisar as zonas de FC
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            Nenhuma atividade selecionada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`glass-card border-glass-border ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-semibold">Teste de Zonas de FC (activity_chart_data)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Análise de zonas de frequência cardíaca usando dados processados
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controles */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">FCmax Override (opcional)</label>
            <Input
              type="number"
              placeholder="ex: 185"
              value={maxHROverride}
              onChange={(e) => setMaxHROverride(e.target.value)}
              disabled={loading}
            />
          </div>
          {loading && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando...
            </div>
          )}
        </div>

        {/* Estatísticas dos dados */}
        {stats && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Estatísticas da Atividade</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fonte:</span>
                <p className="font-medium capitalize">{chartData?.activity_source}</p>
              </div>
              <div>
                <span className="text-muted-foreground">FC Mín:</span>
                <p className="font-medium">{stats.minHR} bpm</p>
              </div>
              <div>
                <span className="text-muted-foreground">FC Máx:</span>
                <p className="font-medium">{stats.maxHR} bpm</p>
              </div>
              <div>
                <span className="text-muted-foreground">FC Média:</span>
                <p className="font-medium">{stats.avgHR} bpm</p>
              </div>
              <div>
                <span className="text-muted-foreground">Pontos FC:</span>
                <p className="font-medium">{stats.dataPoints}/{stats.totalPoints}</p>
              </div>
            </div>
          </div>
        )}

        {/* Distribuição por Zonas */}
        {zones.length > 0 ? (
          <div className="space-y-4">
            <h4 className="font-medium">Distribuição por Zona</h4>
            {zones.map((zone, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                    <span className="text-sm font-medium">{zone.zone}</span>
                    <span className="text-xs text-muted-foreground">({zone.label})</span>
                    <span className="text-xs text-muted-foreground">{zone.minHR}-{zone.maxHR} bpm</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{zone.percentage}%</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(zone.timeInZone / 60)}:{(zone.timeInZone % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <Progress value={zone.percentage} className="flex-1" />
              </div>
            ))}
          </div>
        ) : chartData && (
          <div className="text-center py-8">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Dados de frequência cardíaca não disponíveis nesta atividade</p>
          </div>
        )}

        {!chartData && !loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Insira um ID de atividade para analisar as zonas de FC</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};