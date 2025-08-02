import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, MapPin, Clock, Zap, Target } from 'lucide-react';
import { useBackgroundSession } from '@/hooks/useBackgroundSession';
import { TrainingGoal } from '@/hooks/useRealtimeSession';
import { toast } from 'sonner';

interface BackgroundTrainingSessionProps {
  goal?: TrainingGoal;
  onSessionComplete?: (sessionData: any) => void;
}

export const BackgroundTrainingSession: React.FC<BackgroundTrainingSessionProps> = ({
  goal,
  onSessionComplete,
}) => {
  const [isStarted, setIsStarted] = useState(false);
  
  const backgroundSession = useBackgroundSession({
    goal,
    enableCoaching: true,
    notificationConfig: {
      title: 'BioPeak - Treino Ativo',
      text: 'Rastreamento GPS em andamento',
    },
  });

  const {
    isActive,
    isSupported,
    sessionData,
    error,
    backgroundGPS,
    startBackgroundSession,
    pauseBackgroundSession,
    resumeBackgroundSession,
    stopBackgroundSession,
  } = backgroundSession;

  useEffect(() => {
    if (error) {
      toast.error(`Erro na sessão: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    if (!isSupported) {
      toast.warning('Funcionalidade de background não disponível no navegador. Use um dispositivo móvel para melhor experiência.');
    }
  }, [isSupported]);

  const handleStart = async () => {
    try {
      await startBackgroundSession(goal);
      setIsStarted(true);
      toast.success('Sessão em background iniciada! O app continua funcionando mesmo com a tela bloqueada.');
    } catch (error) {
      toast.error('Erro ao iniciar sessão em background');
      console.error(error);
    }
  };

  const handlePause = async () => {
    try {
      if (sessionData?.isPaused) {
        await resumeBackgroundSession();
        toast.success('Treino retomado');
      } else {
        await pauseBackgroundSession();
        toast.success('Treino pausado');
      }
    } catch (error) {
      toast.error('Erro ao pausar/retomar sessão');
    }
  };

  const handleStop = async () => {
    try {
      await stopBackgroundSession();
      setIsStarted(false);
      
      if (sessionData && onSessionComplete) {
        onSessionComplete(sessionData);
      }
      
      toast.success('Sessão finalizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao finalizar sessão');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatPace = (pace: number): string => {
    if (pace === 0) return '--:--';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isStarted && !isActive) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Treino em Background
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Inicie um treino que continua funcionando mesmo com a tela bloqueada ou em outros apps.
          </div>
          
          {goal && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">Objetivo do Treino:</div>
              <div className="text-xs text-muted-foreground mt-1">
                {goal.type === 'target_distance' && goal.targetDistance && 
                  `Distância: ${formatDistance(goal.targetDistance)}`}
                {goal.type === 'target_pace' && goal.targetPace && 
                  `Pace: ${formatPace(goal.targetPace)} min/km`}
                {goal.type === 'target_duration' && goal.targetDuration && 
                  `Duração: ${formatTime(goal.targetDuration)}`}
                {goal.type === 'target_calories' && goal.targetCalories && 
                  `Calorias: ${goal.targetCalories} kcal`}
                {goal.type === 'free_run' && 'Corrida livre'}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center space-x-2">
            <Badge variant={isSupported ? "default" : "secondary"}>
              {isSupported ? "Suportado" : "Limitado"}
            </Badge>
            <Badge variant={backgroundGPS.isSupported ? "default" : "secondary"}>
              {backgroundGPS.isSupported ? "GPS OK" : "GPS Limitado"}
            </Badge>
          </div>

          <Button 
            onClick={handleStart} 
            className="w-full" 
            size="lg"
            disabled={!isSupported}
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Treino em Background
          </Button>
          
          {!isSupported && (
            <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
              ⚠️ Para funcionalidade completa em background, use um dispositivo móvel com o app instalado.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Treino Ativo
          </div>
          <Badge variant={sessionData?.isPaused ? "secondary" : "default"}>
            {sessionData?.isPaused ? "Pausado" : "Ativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas em tempo real */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground">Distância</div>
            <div className="text-lg font-bold">
              {sessionData ? formatDistance(sessionData.distance) : '--'}
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground">Tempo</div>
            <div className="text-lg font-bold">
              {sessionData ? formatTime(sessionData.duration) : '--:--'}
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground">Pace</div>
            <div className="text-lg font-bold">
              {sessionData ? formatPace(sessionData.pace) : '--:--'}
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground">Calorias</div>
            <div className="text-lg font-bold">
              {sessionData ? Math.round(sessionData.calories) : '--'}
            </div>
          </div>
        </div>

        {/* Status do GPS */}
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              backgroundGPS.isActive ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            GPS: {backgroundGPS.locationCount} pontos
          </div>
          <div className="text-xs text-muted-foreground">
            {backgroundGPS.lastLocation && 
              `Precisão: ${Math.round(backgroundGPS.lastLocation.accuracy)}m`}
          </div>
        </div>

        {/* Controles */}
        <div className="flex gap-2">
          <Button
            onClick={handlePause}
            variant={sessionData?.isPaused ? "default" : "secondary"}
            className="flex-1"
          >
            {sessionData?.isPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Retomar
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </>
            )}
          </Button>
          <Button onClick={handleStop} variant="destructive" className="flex-1">
            <Square className="h-4 w-4 mr-2" />
            Finalizar
          </Button>
        </div>

        {/* Indicador de background */}
        <div className="text-xs text-center text-muted-foreground bg-green-50 p-2 rounded">
          ✅ Funcionando em background - pode bloquear a tela
        </div>
      </CardContent>
    </Card>
  );
};