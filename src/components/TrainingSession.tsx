import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useRealtimeSession, TrainingGoal } from '@/hooks/useRealtimeSession';
import { useProfileStats } from '@/hooks/useProfileStats';
import { 
  Play, 
  Pause, 
  Square, 
  Target, 
  Clock, 
  Route, 
  Zap, 
  Heart,
  MapPin,
  Volume2,
  VolumeX
} from 'lucide-react';

const TrainingSession: React.FC = () => {
  const { toast } = useToast();
  const { stats } = useProfileStats();
  const {
    sessionData,
    isRecording,
    isWatchingLocation,
    lastFeedback,
    startSession,
    pauseSession,
    resumeSession,
    completeSession
  } = useRealtimeSession();

  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [goalType, setGoalType] = useState<TrainingGoal['type']>('free_run');
  const [targetDistance, setTargetDistance] = useState('');
  const [targetPace, setTargetPace] = useState('');
  const [targetDuration, setTargetDuration] = useState('');
  const [targetCalories, setTargetCalories] = useState('');
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [subjectiveFeedback, setSubjectiveFeedback] = useState<number>(3);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format distance helper
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  // Format pace helper
  const formatPace = (minPerKm: number): string => {
    if (minPerKm <= 0) return '--:--';
    const minutes = Math.floor(minPerKm);
    const seconds = Math.round((minPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Validate and create goal
  const createGoal = (): TrainingGoal | null => {
    switch (goalType) {
      case 'target_distance':
        const distance = parseFloat(targetDistance) * 1000; // Convert km to meters
        if (!distance || distance <= 0) {
          toast({
            title: "Distância inválida",
            description: "Por favor, insira uma distância válida.",
            variant: "destructive"
          });
          return null;
        }
        return { type: 'target_distance', targetDistance: distance };

      case 'target_pace':
        const [paceMin, paceSec] = targetPace.split(':').map(Number);
        if (!paceMin || isNaN(paceSec)) {
          toast({
            title: "Ritmo inválido",
            description: "Por favor, insira um ritmo válido (ex: 5:30).",
            variant: "destructive"
          });
          return null;
        }
        const paceMinPerKm = paceMin + paceSec / 60;
        const distance2 = parseFloat(targetDistance) * 1000;
        return { 
          type: 'target_pace', 
          targetPace: paceMinPerKm,
          targetDistance: distance2 > 0 ? distance2 : undefined
        };

      case 'target_duration':
        const duration = parseFloat(targetDuration) * 60; // Convert minutes to seconds
        if (!duration || duration <= 0) {
          toast({
            title: "Duração inválida",
            description: "Por favor, insira uma duração válida.",
            variant: "destructive"
          });
          return null;
        }
        return { type: 'target_duration', targetDuration: duration };

      case 'target_calories':
        const calories = parseFloat(targetCalories);
        if (!calories || calories <= 0) {
          toast({
            title: "Meta de calorias inválida",
            description: "Por favor, insira uma meta de calorias válida.",
            variant: "destructive"
          });
          return null;
        }
        return { type: 'target_calories', targetCalories: calories };

      default:
        return { type: 'free_run' };
    }
  };

  // Handle session start
  const handleStartSession = async () => {
    const goal = createGoal();
    if (!goal) return;

    const sessionId = await startSession(goal);
    if (sessionId) {
      setShowGoalSetup(false);
      toast({
        title: "Treino iniciado!",
        description: "Boa corrida! O AI Coach irá te acompanhar.",
      });
    } else {
      toast({
        title: "Erro ao iniciar treino",
        description: "Verifique as permissões de localização.",
        variant: "destructive"
      });
    }
  };

  // Handle session completion
  const handleCompleteSession = async () => {
    await completeSession({ feeling: subjectiveFeedback });
    setShowCompletionDialog(false);
    toast({
      title: "Treino concluído!",
      description: "Parabéns! Seus dados foram salvos.",
    });
  };

  // Get progress percentage for goals
  const getProgressPercentage = (): number => {
    if (!sessionData) return 0;

    const { goal, currentDistance, currentDuration, calories } = sessionData;
    
    switch (goal.type) {
      case 'target_distance':
        return goal.targetDistance ? (currentDistance / goal.targetDistance) * 100 : 0;
      case 'target_duration':
        return goal.targetDuration ? (currentDuration / goal.targetDuration) * 100 : 0;
      case 'target_calories':
        return goal.targetCalories ? (calories / goal.targetCalories) * 100 : 0;
      default:
        return 0;
    }
  };

  // Toggle sound
  useEffect(() => {
    if (!isSoundEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }, [isSoundEnabled]);

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              AI Training Coach
            </h1>
            <p className="text-xl text-muted-foreground">
              Seu personal trainer virtual te acompanha em tempo real
            </p>
          </div>

          {/* Goal Setup */}
          <Card className="bg-card/80 backdrop-blur border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-6 w-6" />
                Definir Objetivo do Treino
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Goal Type Selection */}
              <div className="space-y-2">
                <Label>Tipo de treino</Label>
                <Select value={goalType} onValueChange={(value: TrainingGoal['type']) => setGoalType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_run">Corrida livre</SelectItem>
                    <SelectItem value="target_distance">Meta de distância</SelectItem>
                    <SelectItem value="target_pace">Meta de ritmo</SelectItem>
                    <SelectItem value="target_duration">Meta de tempo</SelectItem>
                    <SelectItem value="target_calories">Meta de calorias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Goal specific inputs */}
              {goalType === 'target_distance' && (
                <div className="space-y-2">
                  <Label>Distância (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={targetDistance}
                    onChange={(e) => setTargetDistance(e.target.value)}
                    placeholder="ex: 5.0"
                  />
                </div>
              )}

              {goalType === 'target_pace' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ritmo (min:seg/km)</Label>
                    <Input
                      value={targetPace}
                      onChange={(e) => setTargetPace(e.target.value)}
                      placeholder="ex: 5:30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Distância (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={targetDistance}
                      onChange={(e) => setTargetDistance(e.target.value)}
                      placeholder="ex: 5.0"
                    />
                  </div>
                </div>
              )}

              {goalType === 'target_duration' && (
                <div className="space-y-2">
                  <Label>Duração (minutos)</Label>
                  <Input
                    type="number"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value)}
                    placeholder="ex: 30"
                  />
                </div>
              )}

              {goalType === 'target_calories' && (
                <div className="space-y-2">
                  <Label>Calorias</Label>
                  <Input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    placeholder="ex: 300"
                  />
                </div>
              )}

              {/* User stats display */}
              {stats && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold">Suas estatísticas recentes:</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>Ritmo médio: {formatPace(stats.avgPace)}</div>
                    <div>Distância máxima: {formatDistance(stats.longestDistance)}</div>
                  </div>
                </div>
              )}

              <Button onClick={handleStartSession} className="w-full" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Iniciar Treino
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Session Header */}
        <Card className="bg-card/80 backdrop-blur border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`} />
                <h2 className="text-2xl font-bold">
                  {sessionData.goal.type === 'free_run' ? 'Corrida Livre' : 'Treino com Meta'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                >
                  {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Badge variant={isWatchingLocation ? "default" : "secondary"}>
                  <MapPin className="h-3 w-3 mr-1" />
                  GPS {isWatchingLocation ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>

            {/* Progress bar for goal-based workouts */}
            {sessionData.goal.type !== 'free_run' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{getProgressPercentage().toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary rounded-full h-2 transition-all duration-300"
                    style={{ width: `${Math.min(getProgressPercentage(), 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="p-4 text-center">
              <Route className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{formatDistance(sessionData.currentDistance)}</div>
              <div className="text-sm text-muted-foreground">Distância</div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{formatTime(sessionData.currentDuration)}</div>
              <div className="text-sm text-muted-foreground">Tempo</div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{formatPace(sessionData.currentPace)}</div>
              <div className="text-sm text-muted-foreground">Ritmo</div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="p-4 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{sessionData.calories}</div>
              <div className="text-sm text-muted-foreground">Kcal</div>
            </CardContent>
          </Card>
        </div>

        {/* AI Feedback */}
        {lastFeedback && (
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI Coach</h3>
                  <p className="text-sm">{lastFeedback}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="bg-card/80 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex justify-center gap-4">
              {sessionData.status === 'active' ? (
                <Button onClick={pauseSession} variant="outline" size="lg">
                  <Pause className="h-5 w-5 mr-2" />
                  Pausar
                </Button>
              ) : (
                <Button onClick={resumeSession} size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Retomar
                </Button>
              )}
              
              <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    Finalizar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Como você se sentiu neste treino?</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Button
                          key={rating}
                          variant={subjectiveFeedback === rating ? "default" : "outline"}
                          onClick={() => setSubjectiveFeedback(rating)}
                          className="text-2xl"
                        >
                          {rating === 1 ? '😫' : rating === 2 ? '😐' : rating === 3 ? '🙂' : rating === 4 ? '😊' : '🤩'}
                        </Button>
                      ))}
                    </div>
                    <Button onClick={handleCompleteSession} className="w-full">
                      Finalizar Treino
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrainingSession;