import { useMemo } from 'react';

// Função para converter pace string "MM:SS" para number (minutos decimais)
const paceStringToMinutes = (paceStr: string): number => {
  if (!paceStr || typeof paceStr !== 'string') return 0;
  const parts = paceStr.split(':');
  if (parts.length !== 2) return 0;
  const minutes = parseInt(parts[0]);
  const seconds = parseInt(parts[1]);
  if (isNaN(minutes) || isNaN(seconds)) return 0;
  return minutes + (seconds / 60);
};

// Função para converter minutos decimais para "MM:SS"
const minutesToPaceString = (minutes: number): string => {
  if (!minutes || isNaN(minutes) || minutes <= 0) return '';
  const min = Math.floor(minutes);
  const sec = Math.round((minutes % 1) * 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
};

// Função para calcular pace baseado na intensidade
const calculatePaceRange = (baseMinPace: number, baseMaxPace: number, intensity: string) => {
  const intensityLower = intensity.toLowerCase();
  
  if (intensityLower.includes('aquecimento') || intensityLower.includes('warm') || intensityLower.includes('easy')) {
    // Aquecimento: pace mais lento (adiciona 30-60s)
    return {
      min: Math.floor((baseMinPace + 0.5) * 100) / 100,
      max: Math.floor((baseMaxPace + 1.0) * 100) / 100
    };
  } else if (intensityLower.includes('volta') || intensityLower.includes('cool') || intensityLower.includes('recupera')) {
    // Volta à calma: pace mais lento (adiciona 20-40s)
    return {
      min: Math.floor((baseMinPace + 0.3) * 100) / 100,
      max: Math.floor((baseMaxPace + 0.7) * 100) / 100
    };
  } else if (intensityLower.includes('forte') || intensityLower.includes('tempo') || intensityLower.includes('threshold')) {
    // Intensidade forte: pace mais rápido (subtrai 15-30s)
    return {
      min: Math.max(3.0, Math.floor((baseMinPace - 0.5) * 100) / 100),
      max: Math.max(3.5, Math.floor((baseMaxPace - 0.25) * 100) / 100)
    };
  } else if (intensityLower.includes('intervalado') || intensityLower.includes('interval') || intensityLower.includes('tiro')) {
    // Intervalado: pace bem mais rápido (subtrai 30-60s)
    return {
      min: Math.max(2.5, Math.floor((baseMinPace - 1.0) * 100) / 100),
      max: Math.max(3.0, Math.floor((baseMaxPace - 0.5) * 100) / 100)
    };
  }
  
  // Intensidade moderada: pace base
  return { min: baseMinPace, max: baseMaxPace };
};

// Função para formatar pace (garantir ordem correta: menor para maior)
const formatPaceRange = (min: number, max: number) => {
  // Verificar se os valores são válidos
  if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0) {
    return 'N/A';
  }
  
  const minFormatted = `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;
  const maxFormatted = `${Math.floor(max)}:${String(Math.round((max % 1) * 60)).padStart(2, '0')}`;
  
  // Garantir que sempre mostre do menor para o maior
  if (min <= max) {
    return `${minFormatted} a ${maxFormatted}`;
  } else {
    return `${maxFormatted} a ${minFormatted}`;
  }
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTrainingRecommendations } from '@/hooks/useTrainingRecommendations';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import { useActiveTrainingPlan } from '@/hooks/useActiveTrainingPlan';
import { Loader2, RefreshCw, Play, Pause, Calendar } from 'lucide-react';

export default function WeeklyAIPlanCard() {
  const { recommendations, loading: recLoading, error: recError, refreshRecommendations } = useTrainingRecommendations();
  const { briefing, loading: briefLoading, error: briefError, refresh } = useDailyBriefing();
  const { speak, stop, isSpeaking } = useEnhancedTTS();
  const { plan, workouts, loading: planLoading } = useActiveTrainingPlan();

  // Se houver plano ativo, usar workouts do plano; caso contrário, usar recomendações
  const hasActivePlan = !!plan && workouts.length > 0;
  const week = hasActivePlan ? null : recommendations?.weeklyPlan;
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
                <div className="space-y-4">
                  {!briefing?.workout && briefing?.briefing && (
                    <Badge variant="secondary" className="mb-2">
                      🌙 Hoje é dia de descanso programado
                    </Badge>
                  )}
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {briefing?.briefing || 'Carregando sua análise personalizada...'}
                  </p>
                  
                  {/* Botão de Áudio - Transversal Mobile */}
                  <div className="w-full">
                    {isSpeaking ? (
                      <Button 
                        variant="destructive" 
                        size="lg"
                        onClick={stop}
                        className="w-full shadow-lg"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Parar Reprodução
                      </Button>
                    ) : (
                      <Button 
                        variant="default" 
                        size="lg"
                        onClick={onSpeak} 
                        disabled={!briefing?.briefing}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ouvir Briefing
                      </Button>
                    )}
                  </div>
                  
                  {briefing?.workout && (
                    <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Treino Recomendado
                        </span>
                      </div>
                      
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {briefing.workout.sport}
                            </div>
                            <div className="text-muted-foreground">
                              {briefing.workout.duration_min} minutos
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground">
                              Intensidade:
                            </div>
                            <div className="font-medium text-foreground">
                              {briefing.workout.intensity}
                            </div>
                          </div>
                        </div>
                        
                        {briefing.workout.guidance && (
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                              Orientações
                            </div>
                            <div className="grid gap-2">
                              {briefing.workout.guidance.pace_min_per_km && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Pace alvo:</span>
                                   <span className="font-medium text-foreground">
                                     {briefing.workout.guidance.pace_min_per_km.min} a {briefing.workout.guidance.pace_min_per_km.max}
                                   </span>
                                </div>
                              )}
                              {briefing.workout.guidance.hr_bpm && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">FC alvo:</span>
                                  <span className="font-medium text-foreground">
                                    {briefing.workout.guidance.hr_bpm.min}-{briefing.workout.guidance.hr_bpm.max} bpm
                                  </span>
                                </div>
                              )}
                              {briefing.workout.guidance.hr_zone && !briefing.workout.guidance.hr_bpm && (
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Zona alvo:</span>
                                  <span className="font-medium text-foreground">{briefing.workout.guidance.hr_zone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {briefing.workout.structure?.length ? (
                          <div className="bg-card/50 p-3 rounded-lg border border-primary/10">
                            <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                              Estrutura Detalhada
                            </div>
                            <div className="space-y-2">
                              {briefing.workout.structure.map((s, i) => (
                                <div key={i} className="bg-background/80 p-2 rounded border border-muted/20">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-foreground text-xs">
                                      {s.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {s.minutes} min
                                    </span>
                                  </div>
                                  {s.intensity && (
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Intensidade: {s.intensity}
                                    </div>
                                  )}
                                   {briefing.workout.guidance?.pace_min_per_km && s.intensity && (
                                     <div className="text-xs text-muted-foreground">
                                       {(() => {
                                         // Converter strings "MM:SS" para numbers
                                         const baseMinStr = briefing.workout.guidance.pace_min_per_km.min;
                                         const baseMaxStr = briefing.workout.guidance.pace_min_per_km.max;
                                         
                                         if (!baseMinStr || !baseMaxStr) return null;
                                         
                                         const baseMin = paceStringToMinutes(baseMinStr);
                                         const baseMax = paceStringToMinutes(baseMaxStr);
                                         
                                         // Só mostrar se os valores base são válidos
                                         if (isNaN(baseMin) || isNaN(baseMax) || baseMin <= 0 || baseMax <= 0) {
                                           return null;
                                         }
                                         
                                         const adjustedPace = calculatePaceRange(baseMin, baseMax, s.intensity);
                                         const paceMinStr = minutesToPaceString(adjustedPace.min);
                                         const paceMaxStr = minutesToPaceString(adjustedPace.max);
                                         
                                         if (!paceMinStr || !paceMaxStr) return null;
                                         
                                         return `Pace sugerido: ${paceMinStr} a ${paceMaxStr}`;
                                       })()}
                                     </div>
                                   )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
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
          
          {/* Layout Mobile - Lista Vertical */}
          <div className="block sm:hidden space-y-2">
            {hasActivePlan ? (
              // Usar workouts do plano ativo
              (() => {
                const today = new Date();
                const nextWeekWorkouts = workouts
                  .filter(w => {
                    const workoutDate = new Date(w.workout_date);
                    const diffDays = Math.floor((workoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays < 7;
                  })
                  .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime());

                const workoutsByDay = weekDays.map(d => {
                  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(d.key.toLowerCase());
                  const workout = nextWeekWorkouts.find(w => new Date(w.workout_date).getDay() === dayIndex);
                  return { day: d, workout };
                });

                return workoutsByDay.map(({ day: d, workout }, index) => {
                  const isToday = new Date().getDay() === (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(d.key.toLowerCase()));
                  const isRest = !workout || workout.workout_type.toLowerCase().includes('descanso');

                  return (
                    <div 
                      key={d.key} 
                      className={`relative p-4 rounded-lg border transition-all duration-200 ${
                        isToday 
                          ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 shadow-md'
                          : 'bg-card/50 border-muted hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                            {d.label}
                          </span>
                          {isToday && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">HOJE</Badge>
                          )}
                        </div>
                        <Badge 
                          variant={isRest ? 'outline' : 'secondary'} 
                          className="text-[10px] px-2 py-0.5"
                        >
                          {workout?.status === 'completed' ? '✓ Feito' : isRest ? 'Descanso' : 'Planejado'}
                        </Badge>
                      </div>
                      <p className={`text-sm font-medium ${isToday ? 'text-foreground' : 'text-foreground/80'}`}>
                        {workout ? workout.title : 'Descanso'}
                      </p>
                      {workout && workout.duration_minutes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {workout.duration_minutes} min{workout.distance_meters ? ` • ${(workout.distance_meters / 1000).toFixed(1)} km` : ''}
                        </p>
                      )}
                    </div>
                  );
                });
              })()
            ) : week ? (
              weekDays.map((d, index) => {
                const dayPlan = (week as any)[d.key.toLowerCase()] || (week as any)[d.key] || 'Descanso';
                const isRest = dayPlan.toLowerCase().includes('descanso') || dayPlan.toLowerCase().includes('rest');
                const isToday = new Date().getDay() === (index + 1) % 7;
                
                return (
                  <div 
                    key={d.key} 
                    className={`relative p-4 rounded-lg border transition-all duration-200 ${
                      isToday 
                        ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 shadow-md'
                        : isRest 
                          ? 'bg-muted/20 border-muted/40' 
                          : 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          isToday 
                            ? 'bg-gradient-to-r from-primary to-primary/70 animate-pulse'
                            : isRest 
                              ? 'bg-muted-foreground/30' 
                              : 'bg-gradient-to-r from-primary/60 to-primary/40'
                        }`} />
                        <div>
                          <div className={`text-sm font-bold uppercase tracking-wider ${
                            isToday ? 'text-primary' : 'text-muted-foreground'
                          }`}>
                            {d.label}
                          </div>
                          {isToday && (
                            <div className="text-xs text-primary font-medium">HOJE</div>
                          )}
                        </div>
                      </div>
                      <div className={`text-sm font-medium text-right max-w-[60%] ${
                        isRest ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {dayPlan}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="mb-2">⏳</div>
                <div className="text-sm">Carregando seu plano personalizado...</div>
              </div>
            )}
          </div>

          {/* Layout Desktop - Grid 7 colunas */}
          <div className="hidden sm:grid grid-cols-7 gap-2">
            {hasActivePlan ? (
              // Usar workouts do plano ativo
              (() => {
                const today = new Date();
                const nextWeekWorkouts = workouts
                  .filter(w => {
                    const workoutDate = new Date(w.workout_date);
                    const diffDays = Math.floor((workoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays < 7;
                  })
                  .sort((a, b) => new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime());

                const workoutsByDay = weekDays.map(d => {
                  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(d.key.toLowerCase());
                  const workout = nextWeekWorkouts.find(w => new Date(w.workout_date).getDay() === dayIndex);
                  return { day: d, workout };
                });

                return workoutsByDay.map(({ day: d, workout }, index) => {
                  const isToday = new Date().getDay() === (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(d.key.toLowerCase()));
                  const isRest = !workout || workout.workout_type.toLowerCase().includes('descanso');

                  return (
                    <div 
                      key={d.key} 
                      className={`relative p-3 rounded-lg border transition-all duration-200 hover:scale-105 ${
                        isToday 
                          ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 shadow-md'
                          : isRest 
                            ? 'bg-muted/20 border-muted/40 hover:bg-muted/30' 
                            : 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:from-primary/10 hover:to-primary/15'
                      }`}
                    >
                      <div className={`text-xs font-bold text-center mb-2 uppercase tracking-wider ${
                        isToday ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {d.label}
                      </div>
                      <div className={`text-xs leading-tight text-center min-h-[3rem] ${
                        isRest ? 'text-muted-foreground' : 'text-foreground font-medium'
                      }`}>
                        {workout ? workout.title : 'Descanso'}
                      </div>
                      {workout && workout.duration_minutes && (
                        <div className="text-[10px] text-muted-foreground text-center mt-1">
                          {workout.duration_minutes}min
                        </div>
                      )}
                      {isToday && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-pulse" />
                      )}
                      {workout && workout.status === 'completed' && (
                        <div className="absolute top-1 right-1 text-xs">✓</div>
                      )}
                    </div>
                  );
                });
              })()
            ) : week ? (
              weekDays.map((d, index) => {
                const dayPlan = (week as any)[d.key.toLowerCase()] || (week as any)[d.key] || 'Descanso';
                const isRest = dayPlan.toLowerCase().includes('descanso') || dayPlan.toLowerCase().includes('rest');
                const isToday = new Date().getDay() === (index + 1) % 7;
                
                return (
                  <div 
                    key={d.key} 
                    className={`relative p-3 rounded-lg border transition-all duration-200 hover:scale-105 ${
                      isToday 
                        ? 'bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 shadow-md'
                        : isRest 
                          ? 'bg-muted/20 border-muted/40 hover:bg-muted/30' 
                          : 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:from-primary/10 hover:to-primary/15'
                    }`}
                  >
                    <div className={`text-xs font-bold text-center mb-2 uppercase tracking-wider ${
                      isToday ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {d.label}
                    </div>
                    <div className={`text-xs leading-tight text-center ${
                      isRest ? 'text-muted-foreground' : 'text-foreground font-medium'
                    }`}>
                      {dayPlan}
                    </div>
                    {isToday && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-pulse" />
                    )}
                    {!isRest && !isToday && (
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
