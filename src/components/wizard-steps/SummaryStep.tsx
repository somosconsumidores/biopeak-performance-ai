import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrainingPlanWizardData, SWIMMING_GOALS, STRENGTH_GOALS, CYCLING_GOALS } from '@/hooks/useTrainingPlanWizard';
import { 
  Target, 
  User, 
  Calendar, 
  Timer, 
  MapPin, 
  Trophy,
  CheckCircle2,
  Clock,
  Zap,
  Waves,
  Dumbbell,
  Bike,
  Footprints
} from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GOALS = {
  'general_fitness': 'Condicionamento Físico Geral',
  'weight_loss': 'Perda de Peso',
  '5k': 'Primeira Corrida de 5K',
  '10k': 'Corrida de 10K',
  'half_marathon': 'Meia Maratona (21K)',
  'marathon': 'Maratona (42K)',
  'improve_times': 'Melhorar Tempos Atuais',
  'return_running': 'Retorno à Corrida',
  'maintenance': 'Manutenção da Forma',
};

const DAYS_OF_WEEK = {
  'monday': 'Segunda-feira',
  'tuesday': 'Terça-feira',
  'wednesday': 'Quarta-feira',
  'thursday': 'Quinta-feira',
  'friday': 'Sexta-feira',
  'saturday': 'Sábado',
  'sunday': 'Domingo',
};

const ATHLETE_LEVELS = {
  'Beginner': { label: 'Iniciante', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  'Intermediate': { label: 'Intermediário', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  'Advanced': { label: 'Avançado', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  'Elite': { label: 'Elite', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
};

const SWIMMING_LEVELS = {
  'beginner': { label: 'Iniciante', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
  'intermediate': { label: 'Intermediário', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  'advanced': { label: 'Avançado', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
};

const STRENGTH_EQUIPMENT_LABELS = {
  'full_gym': 'Academia Completa',
  'home_basic': 'Home Gym Básico',
  'bodyweight': 'Peso Corporal',
};

const STRENGTH_GOAL_LABELS = {
  'injury_prevention': 'Prevenção de Lesões',
  'performance': 'Melhoria de Performance',
  'general': 'Fortalecimento Geral',
  'core': 'Foco em Core',
};

interface SummaryStepProps {
  wizardData: TrainingPlanWizardData;
  calculateTargetTime?: () => number | undefined;
}

export function SummaryStep({ wizardData, calculateTargetTime }: SummaryStepProps) {
  const endDate = addWeeks(wizardData.startDate, wizardData.planDurationWeeks);
  const athleteLevel = ATHLETE_LEVELS[wizardData.athleteLevel];
  
  // Calculate target time for race goals
  const targetTimeMinutes = calculateTargetTime ? calculateTargetTime() : undefined;
  
  // Format target time to display
  const formatTargetTime = (minutes: number | undefined) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format CSS to display
  const formatCSS = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}/100m`;
  };

  // Get sport-specific icon and color
  const getSportIcon = () => {
    switch (wizardData.sportType) {
      case 'swimming': return <Waves className="h-8 w-8 text-cyan-500" />;
      case 'cycling': return <Bike className="h-8 w-8 text-blue-500" />;
      case 'strength': return <Dumbbell className="h-8 w-8 text-purple-500" />;
      default: return <Footprints className="h-8 w-8 text-green-500" />;
    }
  };

  const getSportLabel = () => {
    switch (wizardData.sportType) {
      case 'swimming': return 'Natação';
      case 'cycling': return 'Ciclismo';
      case 'strength': return 'Força';
      default: return 'Corrida';
    }
  };

  const getGoalLabel = () => {
    if (wizardData.sportType === 'swimming') {
      return SWIMMING_GOALS.find(g => g.id === wizardData.goal)?.label || wizardData.goal;
    }
    if (wizardData.sportType === 'cycling') {
      return CYCLING_GOALS.find(g => g.id === wizardData.goal)?.label || wizardData.goal;
    }
    if (wizardData.sportType === 'strength') {
      return STRENGTH_GOAL_LABELS[wizardData.strengthGoal as keyof typeof STRENGTH_GOAL_LABELS] || wizardData.strengthGoal;
    }
    return GOALS[wizardData.goal as keyof typeof GOALS] || wizardData.goal;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
          {getSportIcon()}
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Seu Plano de {getSportLabel()}</h3>
          <p className="text-sm text-muted-foreground">
            Revise todas as informações antes de gerar seu plano
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {/* Beginner Notice for Running */}
      {wizardData.sportType === 'running' && wizardData.unknownPaces && (['5k', '10k', 'half_marathon', '21k', 'marathon', '42k'].includes(wizardData.goal)) && (
        <Card className="glass-card border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Plano para Iniciante
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                  Como você não tem histórico de corridas, criaremos um plano conservador e 
                  progressivo. Os ritmos e distâncias iniciais serão confortáveis, 
                  aumentando gradualmente para prepará-lo com segurança para sua meta.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {/* Goal */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Objetivo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="font-medium text-foreground">
              {getGoalLabel()}
            </div>
            {wizardData.goalDescription && (
              <div className="text-sm text-muted-foreground mt-1">
                {wizardData.goalDescription}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Athlete Profile - Running */}
        {wizardData.sportType === 'running' && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Perfil do Atleta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nível:</span>
                <Badge variant="secondary" className={athleteLevel.color}>
                  {athleteLevel.label}
                </Badge>
              </div>
              
              {wizardData.birthDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nascimento:</span>
                  <span className="text-sm font-medium">
                    {format(wizardData.birthDate, "dd/MM/yyyy")}
                  </span>
                </div>
              )}
              
              {wizardData.gender && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gênero:</span>
                  <span className="text-sm font-medium">
                    {wizardData.gender === 'male' ? 'Masculino' : 'Feminino'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Swimming Profile */}
        {wizardData.sportType === 'swimming' && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Waves className="h-4 w-4 text-cyan-500" />
                Perfil de Natação
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {wizardData.swimmingLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nível:</span>
                  <Badge variant="secondary" className={SWIMMING_LEVELS[wizardData.swimmingLevel].color}>
                    {SWIMMING_LEVELS[wizardData.swimmingLevel].label}
                  </Badge>
                </div>
              )}
              
              {wizardData.cssSecondsPerHundred && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CSS:</span>
                  <span className="text-sm font-medium font-mono">
                    {formatCSS(wizardData.cssSecondsPerHundred)}
                  </span>
                </div>
              )}
              
              {wizardData.poolLength && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Piscina:</span>
                  <Badge variant="outline">{wizardData.poolLength}m</Badge>
                </div>
              )}
              
              {wizardData.swimmingEquipment && wizardData.swimmingEquipment.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Equipamentos:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {wizardData.swimmingEquipment.map(eq => (
                      <Badge key={eq} variant="secondary" className="text-xs">
                        {eq === 'palmar' ? 'Palmar' : 
                         eq === 'nadadeira' ? 'Nadadeira' :
                         eq === 'pull_buoy' ? 'Pull Buoy' :
                         eq === 'snorkel' ? 'Snorkel' : eq}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Strength Profile */}
        {wizardData.sportType === 'strength' && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-purple-500" />
                Perfil de Força
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {wizardData.strengthGoal && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Objetivo:</span>
                  <span className="text-sm font-medium">
                    {STRENGTH_GOAL_LABELS[wizardData.strengthGoal]}
                  </span>
                </div>
              )}
              
              {wizardData.strengthEquipment && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Equipamentos:</span>
                  <Badge variant="secondary">
                    {STRENGTH_EQUIPMENT_LABELS[wizardData.strengthEquipment]}
                  </Badge>
                </div>
              )}
              
              {wizardData.strengthFrequency && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Frequência:</span>
                  <Badge variant="outline">{wizardData.strengthFrequency}x por semana</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cycling Profile */}
        {wizardData.sportType === 'cycling' && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bike className="h-4 w-4 text-blue-500" />
                Perfil de Ciclismo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {wizardData.cyclingLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nível:</span>
                  <Badge variant="secondary" className={ATHLETE_LEVELS[wizardData.cyclingLevel === 'beginner' ? 'Beginner' : wizardData.cyclingLevel === 'intermediate' ? 'Intermediate' : 'Advanced'].color}>
                    {wizardData.cyclingLevel === 'beginner' ? 'Iniciante' : wizardData.cyclingLevel === 'intermediate' ? 'Intermediário' : 'Avançado'}
                  </Badge>
                </div>
              )}
              
              {wizardData.ftpWatts && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">FTP:</span>
                  <span className="text-sm font-medium font-mono">{wizardData.ftpWatts}W</span>
                </div>
              )}
              
              {wizardData.equipmentType && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Equipamento:</span>
                  <Badge variant="outline">
                    {wizardData.equipmentType === 'road' ? 'Speed' : 
                     wizardData.equipmentType === 'mtb' ? 'Mountain Bike' :
                     wizardData.equipmentType === 'trainer' ? 'Rolo/Trainer' : 'Misto'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Times - Running only */}
        {wizardData.sportType === 'running' && Object.values(wizardData.estimatedTimes).some(time => time) && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Tempos Atuais
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                {wizardData.estimatedTimes.k5 && (
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="font-mono font-medium text-primary">{wizardData.estimatedTimes.k5}</div>
                    <div className="text-xs text-muted-foreground">5K</div>
                  </div>
                )}
                {wizardData.estimatedTimes.k10 && (
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="font-mono font-medium text-primary">{wizardData.estimatedTimes.k10}</div>
                    <div className="text-xs text-muted-foreground">10K</div>
                  </div>
                )}
                {wizardData.estimatedTimes.k21 && (
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="font-mono font-medium text-primary">{wizardData.estimatedTimes.k21}</div>
                    <div className="text-xs text-muted-foreground">21K</div>
                  </div>
                )}
                {wizardData.estimatedTimes.k42 && (
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="font-mono font-medium text-primary">{wizardData.estimatedTimes.k42}</div>
                    <div className="text-xs text-muted-foreground">42K</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Training Schedule - Not for Strength */}
        {wizardData.sportType !== 'strength' && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Cronograma de Treino
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {wizardData.sportType === 'running' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Frequência:</span>
                  <Badge variant="outline">
                    {wizardData.weeklyFrequency}x por semana
                  </Badge>
                </div>
              )}
              
              {(wizardData.sportType === 'swimming' || wizardData.sportType === 'cycling') && wizardData.availableHoursPerWeek && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Horas/semana:</span>
                  <Badge variant="outline">
                    {wizardData.availableHoursPerWeek}h
                  </Badge>
                </div>
              )}
              
              <div>
                <span className="text-sm text-muted-foreground">Dias disponíveis:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {wizardData.availableDays.map(dayId => (
                    <Badge key={dayId} variant="secondary" className="text-xs">
                      {DAYS_OF_WEEK[dayId as keyof typeof DAYS_OF_WEEK]}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {wizardData.sportType === 'running' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Corrida longa:</span>
                  <span className="text-sm font-medium">
                    {DAYS_OF_WEEK[wizardData.longRunDay as keyof typeof DAYS_OF_WEEK]}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Duration */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Duração do Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Início:</span>
              <span className="text-sm font-medium">
                {format(wizardData.startDate, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duração:</span>
              <Badge variant="outline">
                {wizardData.planDurationWeeks} semanas
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Término:</span>
              <span className="text-sm font-medium">
                {format(endDate, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Race Date (if applicable) - Running only */}
        {wizardData.sportType === 'running' && wizardData.hasRaceDate && wizardData.raceDate && (
          <Card className="glass-card border-primary/20 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Data da Prova
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center">
                <div className="font-medium text-primary text-lg">
                  {format(wizardData.raceDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(wizardData.raceDate, "EEEE", { locale: ptBR })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Target Time for Race Goals - Running only */}
        {wizardData.sportType === 'running' && (['5k', '10k', 'half_marathon', '21k', 'marathon', '42k'].includes(wizardData.goal)) && targetTimeMinutes && (
          <Card className="glass-card border-accent/20 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Tempo Alvo do Objetivo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center">
                <div className="font-mono font-bold text-accent text-2xl">
                  {formatTargetTime(targetTimeMinutes)}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Meta calculada baseada no seu histórico, nível atual e duração do plano
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Race Goal (if applicable) */}
        {wizardData.raceGoal && (
          <Card className="glass-card border-accent/20 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Meta da Prova
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center">
                <div className="font-medium text-accent text-lg">
                  {wizardData.raceGoal}
                </div>
                {wizardData.goalTargetTimeMinutes && (
                  <div className="text-sm text-muted-foreground">
                    Tempo alvo: {Math.floor(wizardData.goalTargetTimeMinutes / 60)}:{(wizardData.goalTargetTimeMinutes % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* What happens next */}
      <Card className="glass-card bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            O que acontece agora?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Geração do Plano</div>
              <div className="text-xs text-muted-foreground">
                Nosso algoritmo criará treinos personalizados baseados em suas informações
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Acesso ao Plano</div>
              <div className="text-xs text-muted-foreground">
                Você poderá visualizar e acompanhar seus treinos diariamente
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Acompanhamento</div>
              <div className="text-xs text-muted-foreground">
                Registre seus treinos e receba feedback personalizado
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
