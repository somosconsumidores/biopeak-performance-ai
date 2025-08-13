import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileUp, History, Activity, Timer } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface GpxActivitySummary {
  id: string;
  activity_id: string;
  name: string | null;
  activity_type: string | null;
  start_time: string | null;
  distance_in_meters: number | null;
  duration_in_seconds: number | null;
  created_at: string;
}

export const StravaGpxImport: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [activityType, setActivityType] = useState('RUNNING');
  const [isUploading, setIsUploading] = useState(false);
  const [recent, setRecent] = useState<GpxActivitySummary[]>([]);

  const fetchRecent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('strava_gpx_activities')
      .select('id, activity_id, name, activity_type, start_time, distance_in_meters, duration_in_seconds, created_at')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(5);
    setRecent(data || []);
  };

  useEffect(() => { fetchRecent(); }, [user]);

  const handleUpload = async () => {
    try {
      if (!user) {
        toast({ title: 'Autenticação necessária', description: 'Faça login para importar GPX', variant: 'destructive' });
        return;
      }
      if (!file) {
        toast({ title: 'Selecione um arquivo', description: 'Escolha um arquivo .gpx para importar' });
        return;
      }
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        toast({ title: 'Formato inválido', description: 'Apenas arquivos .gpx são suportados', variant: 'destructive' });
        return;
      }

      setIsUploading(true);

      const filePath = `${user.id}/${Date.now()}-${uuidv4()}.gpx`;
      const { error: upErr } = await supabase.storage.from('gpx').upload(filePath, file, {
        contentType: 'application/gpx+xml',
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: res, error: fnErr } = await supabase.functions.invoke('import-strava-gpx', {
        body: { file_path: filePath, activity_type: activityType, name: name || file.name.replace(/\.gpx$/i, '') },
      });
      if (fnErr) throw fnErr;

      toast({ title: 'Importação concluída', description: `Atividade criada com ${(res?.metrics?.distance_in_meters/1000).toFixed(2)} km` });
      setFile(null); setName(''); setActivityType('RUNNING');
      await fetchRecent();
    } catch (e: any) {
      console.error('GPX import error', e);
      toast({ title: 'Erro ao importar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const formatDistance = (m?: number | null) => m ? `${(m/1000).toFixed(2)} km` : '—';
  const formatDuration = (s?: number | null) => {
    if (!s) return '—';
    const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <Upload className="h-6 w-6 text-primary" />
              Importar GPX (Strava)
            </CardTitle>
            <CardDescription>
              Envie um arquivo GPX 1.1 do Strava. As atividades serão identificadas como "Strava GPX".
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Arquivo GPX</label>
            <input
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Nome (opcional)</label>
              <input
                className="w-full px-3 py-2 rounded-md bg-card border border-border"
                placeholder="Meu treino"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Tipo</label>
              <select
                className="w-full px-3 py-2 rounded-md bg-card border border-border"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                <option value="RUNNING">Corrida</option>
                <option value="CYCLING">Ciclismo</option>
                <option value="WALKING">Caminhada</option>
              </select>
            </div>
          </div>
          
          <Button onClick={handleUpload} disabled={isUploading || !file} className="w-full">
            <FileUp className="h-4 w-4 mr-2" />
            {isUploading ? 'Importando...' : 'Importar'}
          </Button>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <History className="h-4 w-4" /> Últimas importações (GPX)
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma importação realizada ainda.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {recent.map((a) => (
                <div key={a.id} className="metric-card flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{a.name || 'Atividade GPX'}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.start_time || a.created_at).toLocaleString('pt-BR')} • {a.activity_type || 'Atividade'}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-2 justify-end"><Activity className="h-3 w-3" /> {formatDistance(a.distance_in_meters)}</div>
                    <div className="flex items-center gap-2 justify-end"><Timer className="h-3 w-3" /> {formatDuration(a.duration_in_seconds)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
