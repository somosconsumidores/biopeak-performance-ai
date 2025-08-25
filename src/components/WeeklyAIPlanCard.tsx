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
    { key: 'monday', label: 'SEG' },
    { key: 'tuesday', label: 'TER' },
    { key: 'wednesday', label: 'QUA' },
    { key: 'thursday', label: 'QUI' },
    { key: 'friday', label: 'SEX' },
    { key: 'saturday', label: 'SÁB' },
    { key: 'sunday', label: 'DOM' },
  ] as const), []);

  const onSpeak = () => {
    if (!briefing?.briefing) return;
    const w = briefing.workout;
    const details = w ? ` Treino do dia: ${w.sport || 'corrida'} ${w.duration_min ? `${w.duration_min} min` : ''} ${w.intensity ? `(${w.intensity})` : ''}` +
      `${w?.guidance?.pace_min_per_km ? `, pace ${w.guidance.pace_min_per_km.min}-${w.guidance.pace_min_per_km.max} min por km` : ''}` +
      `${w?.guidance?.hr_bpm ? `, frequência cardíaca ${w.guidance.hr_bpm.min}-${w.guidance.hr_bpm.max} bpm` : w?.guidance?.hr_zone ? `, ${w.guidance.hr_zone}` : ''}` : '';
    const text = `${briefing.briefing} ${details}`.replace(/[*_`~>#\-+|]/g, ' ').replace(/[\u{1F300}-\u{1FAFF}]/gu, '').replace(/\s{2,}/g,' ');
    speak(text, { voice: 'Aria', speed: 1.0 });
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-primary/5 border border-primary/20 shadow-lg backdrop-blur-sm">
      <div className="absolute inset-0 bg-grid-small opacity-[0.02]" />
      
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 backdrop-blur-sm">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Coach IA Premium
              </h2>
              <p className="text-sm text-muted-foreground">Seu plano inteligente personalizado</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} className="text-xs hover:bg-primary/10">
              <RefreshCw className="h-3 w-3 mr-1" />
              Briefing
            </Button>
            <Button variant="ghost" size="sm" onClick={refreshRecommendations} className="text-xs hover:bg-primary/10">
              <RefreshCw className="h-3 w-3 mr-1" />
              Plano
            </Button>
          </div>
        </div>
      </div>

      <div className="relative p-6 space-y-6">
        {/* Daily Briefing - Premium Section */}
        <div className="relative">
          <div className="absolute -top-2 -left-2 w-20 h-20 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-xl" />
          <div className="relative bg-card/80 backdrop-blur-sm rounded-xl border border-primary/10 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-foreground">Briefing Hoje</span>
                  {briefing?.date && (
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      {new Date(briefing.date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {isSpeaking ? (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={stop}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    Parar
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={onSpeak} 
                    disabled={!briefing?.briefing}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Ouvir 90s
                  </Button>
                )}
              </div>
            </div>
            
            <div className="p-4">
              {briefLoading ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Gerando seu briefing personalizado...</span>
                </div>
              ) : briefError ? (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  {briefError}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {briefing?.briefing || 'Carregando sua análise personalizada...'}
                  </p>
                  
                  {briefing?.workout && (
                    <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Treino Recomendado
                        </span>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            {briefing.workout.sport} • {briefing.workout.duration_min}min
                          </div>
                          <div className="text-muted-foreground">
                            Intensidade: <span className="font-medium text-foreground">{briefing.workout.intensity}</span>
                          </div>
                        </div>
                        
                        {briefing.workout.guidance && (
                          <div className="space-y-1">
                            {briefing.workout.guidance.pace_min_per_km && (
                              <div className="text-muted-foreground">
                                Pace: <span className="font-medium text-foreground">
                                  {briefing.workout.guidance.pace_min_per_km.min}-{briefing.workout.guidance.pace_min_per_km.max} min/km
                                </span>
                              </div>
                            )}
                            {briefing.workout.guidance.hr_bpm && (
                              <div className="text-muted-foreground">
                                FC: <span className="font-medium text-foreground">
                                  {briefing.workout.guidance.hr_bpm.min}-{briefing.workout.guidance.hr_bpm.max} bpm
                                </span>
                              </div>
                            )}
                            {briefing.workout.guidance.hr_zone && !briefing.workout.guidance.hr_bpm && (
                              <div className="text-muted-foreground">
                                Zona: <span className="font-medium text-foreground">{briefing.workout.guidance.hr_zone}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {briefing.workout.structure?.length ? (
                        <div className="mt-3 pt-3 border-t border-primary/10">
                          <div className="text-xs text-muted-foreground mb-2">Estrutura do Treino:</div>
                          <div className="flex flex-wrap gap-2">
                            {briefing.workout.structure.map((s, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {s.name} {s.minutes}min{s.intensity ? ` (${s.intensity})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Weekly Plan */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
            <h3 className="text-lg font-semibold text-foreground">Plano da Semana</h3>
            {recLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {recError && (
              <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                {recError}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {week ? (
              weekDays.map((d, index) => {
                const dayPlan = (week as any)[d.key.toLowerCase()] || (week as any)[d.key] || 'Descanso';
                const isRest = dayPlan.toLowerCase().includes('descanso') || dayPlan.toLowerCase().includes('rest');
                
                return (
                  <div 
                    key={d.key} 
                    className={`relative p-3 rounded-lg border transition-all duration-200 hover:scale-105 ${
                      isRest 
                        ? 'bg-muted/20 border-muted/40 hover:bg-muted/30' 
                        : 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:from-primary/10 hover:to-primary/15'
                    }`}
                  >
                    <div className="text-xs font-bold text-center mb-2 text-muted-foreground uppercase tracking-wider">
                      {d.label}
                    </div>
                    <div className={`text-xs leading-tight text-center ${
                      isRest ? 'text-muted-foreground' : 'text-foreground font-medium'
                    }`}>
                      {dayPlan}
                    </div>
                    {!isRest && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gradient-to-r from-primary to-primary/70" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-7 text-center py-8 text-muted-foreground">
                <div className="mb-2">⏳</div>
                <div className="text-sm">Carregando seu plano personalizado...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
