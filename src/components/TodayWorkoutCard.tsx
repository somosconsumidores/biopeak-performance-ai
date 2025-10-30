import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Zap, Heart, Volume2, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import type { TrainingWorkout } from '@/hooks/useActiveTrainingPlan';
import type { DailyBriefingResponse } from '@/hooks/useDailyBriefing';

interface TodayWorkoutCardProps {
  workout: TrainingWorkout;
  briefing: DailyBriefingResponse | null;
  onStartWorkout: () => void;
  onViewDetails?: () => void;
}

export const TodayWorkoutCard = ({ workout, briefing, onStartWorkout, onViewDetails }: TodayWorkoutCardProps) => {
  const { speak, isSpeaking, stop } = useEnhancedTTS();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatPace = (minPerKm?: number) => {
    if (!minPerKm) return null;
    const minutes = Math.floor(minPerKm);
    const seconds = Math.round((minPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getWorkoutTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'easy': 'Corrida Leve',
      'long_run': 'Corrida Longa',
      'tempo': 'Treino Tempo',
      'interval': 'Intervalado',
      'threshold': 'Limiar',
      'recovery': 'Recuperação',
      'fartlek': 'Fartlek',
      'hill_repeats': 'Subidas',
      'race': 'Prova',
      'cross_training': 'Treino Cruzado',
    };
    return typeMap[type] || type;
  };

  const getWorkoutTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'easy': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      'long_run': 'bg-purple-500/20 text-purple-500 border-purple-500/30',
      'tempo': 'bg-orange-500/20 text-orange-500 border-orange-500/30',
      'interval': 'bg-red-500/20 text-red-500 border-red-500/30',
      'threshold': 'bg-amber-500/20 text-amber-500 border-amber-500/30',
      'recovery': 'bg-green-500/20 text-green-500 border-green-500/30',
      'fartlek': 'bg-pink-500/20 text-pink-500 border-pink-500/30',
      'hill_repeats': 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
      'race': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      'cross_training': 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
    };
    return colorMap[type] || 'bg-primary/20 text-primary border-primary/30';
  };

  const handleSpeakBriefing = () => {
    if (isSpeaking) {
      stop();
      return;
    }

    let text = '';
    
    if (briefing?.briefing) {
      text = briefing.briefing + ' ';
    }
    
    text += `Treino do dia: ${workout.title}. `;
    
    if (workout.description) {
      text += workout.description + ' ';
    }

    const metrics: string[] = [];
    if (workout.distance_meters) metrics.push(`${formatDistance(workout.distance_meters)}`);
    if (workout.duration_minutes) metrics.push(`${formatDuration(workout.duration_minutes)}`);
    if (workout.target_pace_min_km) metrics.push(`pace alvo ${formatPace(workout.target_pace_min_km)}`);
    if (workout.target_hr_zone) metrics.push(`zona ${workout.target_hr_zone}`);
    
    if (metrics.length > 0) {
      text += 'Métricas: ' + metrics.join(', ') + '.';
    }

    speak(text, { voice: 'Aria', speed: 1.0 });
  };

  return (
    <Card className="glass-card border-glass-border overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5 border-b border-primary/20">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {format(parseISO(workout.workout_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <CardTitle className="text-2xl">
              📅 Treino Recomendado
            </CardTitle>
          </div>
          <Badge className={`${getWorkoutTypeColor(workout.workout_type)} border`}>
            {getWorkoutTypeLabel(workout.workout_type)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Workout Title & Description */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{workout.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {workout.description}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {workout.distance_meters && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Distância</div>
                <div className="font-semibold">{formatDistance(workout.distance_meters)}</div>
              </div>
            </div>
          )}
          
          {workout.duration_minutes && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Duração</div>
                <div className="font-semibold">{formatDuration(workout.duration_minutes)}</div>
              </div>
            </div>
          )}
          
          {workout.target_pace_min_km && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Pace Alvo</div>
                <div className="font-semibold">{formatPace(workout.target_pace_min_km)}</div>
              </div>
            </div>
          )}
          
          {workout.target_hr_zone && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3">
              <Heart className="h-4 w-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Zona FC</div>
                <div className="font-semibold">Zona {workout.target_hr_zone}</div>
              </div>
            </div>
          )}
        </div>

        {/* Briefing Section */}
        {briefing?.briefing && (
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                Briefing do Dia
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSpeakBriefing}
                className={isSpeaking ? "text-primary" : ""}
              >
                {isSpeaking ? (
                  <>
                    <div className="animate-pulse h-4 w-4 rounded-full bg-primary mr-2" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Ouvir
                  </>
                )}
              </Button>
            </div>
            
            <p className={`text-sm text-muted-foreground ${isExpanded ? '' : 'line-clamp-3'}`}>
              {briefing.briefing}
            </p>
            
            {briefing.briefing.length > 150 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-primary hover:underline"
              >
                {isExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onStartWorkout}
            className="flex-1 h-12 text-base"
            size="lg"
          >
            <ChevronRight className="h-5 w-5 mr-2" />
            Iniciar Treino
          </Button>
          
          {onViewDetails && (
            <Button
              onClick={onViewDetails}
              variant="outline"
              className="glass-card border-glass-border h-12"
              size="lg"
            >
              Ver Detalhes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
