import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Play } from 'lucide-react';

// Keep local union in sync with edge function
type Source = 'garmin' | 'polar' | 'strava' | 'strava_gpx' | 'zepp_gpx' | 'all';

export const VariationBackfillSection = () => {
  const { toast } = useToast();
  const [source, setSource] = useState<Source>('garmin');
  const [limit, setLimit] = useState<number>(200);
  const [offset, setOffset] = useState<number>(0);
  const [userId, setUserId] = useState<string>('');
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  const runBackfill = async (params?: Partial<{ source: Source; limit: number; offset: number; user_id?: string; dryRun: boolean }>) => {
    setLoading(true);
    setResult(null);
    try {
      const body = {
        source,
        limit,
        offset,
        dryRun,
        user_id: userId.trim() || undefined,
        ...params,
      };
      const response = await supabase.functions.invoke('backfill-variation-analysis-runner', { body });
      if (response.error) throw response.error;
      setResult(response.data);
      toast({ title: 'Backfill executado', description: 'Lote processado com sucesso.' });
    } catch (err: any) {
      console.error('Backfill error:', err);
      toast({ title: 'Erro ao executar backfill', description: err?.message || 'Falha desconhecida', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const quickGarminRun = () => runBackfill({ source: 'garmin', limit: 200, offset: 0, dryRun: false });

  const sources: Source[] = ['garmin', 'polar', 'strava', 'strava_gpx', 'zepp_gpx', 'all'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Backfill - Análise de Variação</CardTitle>
        <CardDescription>
          Dispare lotes paginados que constroem o cache de gráficos e recalculam a tabela variation_analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Fonte</Label>
            <Select value={source} onValueChange={(v: Source) => setSource(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fonte" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Limite</Label>
            <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>

          <div className="space-y-2">
            <Label>Offset</Label>
            <Input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>User ID (opcional)</Label>
            <Input placeholder="UUID do usuário (para filtrar)" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={dryRun} onCheckedChange={setDryRun} id="dryrun" />
            <Label htmlFor="dryrun">Dry Run</Label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => runBackfill()} disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Processando...' : 'Executar Lote'}
          </Button>
          <Button onClick={quickGarminRun} variant="secondary" disabled={loading} className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Rodar Garmin (200)
          </Button>
        </div>

        {result && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-semibold">Resultado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(result.results || {}).map(([k, v]: any) => (
                <div key={k} className="rounded-md border p-3 text-sm">
                  <div className="font-medium mb-1">Fonte: {k}</div>
                  <div>Buscados: {v.fetched}</div>
                  <div>Processados: {v.processed}</div>
                  <div>OK: {v.ok}</div>
                  <div>Falhas: {v.failures?.length || 0}</div>
                  <div>Próximo offset sugerido: {v.next_offset}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
