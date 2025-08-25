import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTrainingRecommendations } from '@/hooks/useTrainingRecommendations';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import { Loader2, RefreshCw, Play, Pause, Calendar } from 'lucide-react';

export default function WeeklyAIPlanCard() {
  const { recommendations, loading: recLoading, error: recError, refreshRecommendations } = useTrainingRecommendations();
  const { briefing, loading: briefLoading, error: briefError, refresh } = useDailyBriefing();
  const { speak, stop, isSpeaking } = useEnhancedTTS();

  const week = recommendations?.weeklyPlan;
  const weekDays = useMemo(() => ([
    { key: 'monday', label: 'Segunda' },
    { key: 'tuesday', label: 'Terça' },
    { key: 'wednesday', label: 'Quarta' },
    { key: 'thursday', label: 'Quinta' },
    { key: 'friday', label: 'Sexta' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'Sunday', label: 'Domingo' },
  ] as const), []);

  const onSpeak = () => {
    if (briefing?.briefing) {
      speak(briefing.briefing, { voice: 'Aria', speed: 1.0 });
    }
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Plano Semanal IA
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { refresh(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Briefing
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { refreshRecommendations(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Plano
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Briefing Diário */}
        <div className="p-3 rounded-lg bg-muted/40 border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">Briefing do Dia</Badge>
                {briefing?.date && <span className="text-xs text-muted-foreground">{new Date(briefing.date).toLocaleDateString()}</span>}
              </div>
              {briefLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> Gerando briefing...</div>
              ) : briefError ? (
                <div className="text-sm text-destructive">{briefError}</div>
              ) : (
                <p className="text-sm leading-relaxed">{briefing?.briefing || 'Sem briefing disponível.'}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              {isSpeaking ? (
                <Button variant="default" size="sm" onClick={() => stop()}>
                  <Pause className="h-4 w-4 mr-1"/> Parar
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={onSpeak} disabled={!briefing?.briefing}>
                  <Play className="h-4 w-4 mr-1"/> Ouvir 90s
                </Button>
              )}
            </div>
          </div>
          {briefing?.suggested_workout && (
            <div className="mt-2 text-xs text-muted-foreground">
              Sugestão do dia: <span className="font-medium text-foreground">{briefing.suggested_workout}</span>
            </div>
          )}
        </div>

        {/* Plano Semanal */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">Plano Semanal</Badge>
            {recLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
            {recError && <span className="text-xs text-destructive">{recError}</span>}
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {week ? (
              weekDays.map(d => (
                <div key={d.key as string} className="p-3 rounded-lg border bg-card/50">
                  <div className="text-xs text-muted-foreground mb-1">{d.label}</div>
                  <div className="text-sm leading-snug">{(week as any)[d.key.toLowerCase?.() ? 'key' : 'monday'] ?? (week as any)[d.key.toLowerCase?.() || 'monday']}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Sem plano disponível.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
