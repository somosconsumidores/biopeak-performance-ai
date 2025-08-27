import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { 
  Target, 
  User, 
  Calendar, 
  Timer, 
  MapPin, 
  Trophy,
  CheckCircle2,
  Clock,
  Zap
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

interface SummaryStepProps {
  wizardData: TrainingPlanWizardData;
}

export function SummaryStep({ wizardData }: SummaryStepProps) {
  const endDate = addWeeks(wizardData.startDate, wizardData.planDurationWeeks);
  const athleteLevel = ATHLETE_LEVELS[wizardData.athleteLevel];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Seu Plano Personalizado</h3>
          <p className="text-sm text-muted-foreground">
            Revise todas as informações antes de gerar seu plano de treino
          </p>
        </div>
      </div>

      {/* Summary cards */}
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
              {GOALS[wizardData.goal as keyof typeof GOALS] || wizardData.goal}
            </div>
            {wizardData.goalDescription && (
              <div className="text-sm text-muted-foreground mt-1">
                {wizardData.goalDescription}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Athlete Profile */}
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

        {/* Current Times */}
        {Object.values(wizardData.estimatedTimes).some(time => time) && (
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

        {/* Training Schedule */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Cronograma de Treino
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Frequência:</span>
              <Badge variant="outline">
                {wizardData.weeklyFrequency}x por semana
              </Badge>
            </div>
            
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
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Corrida longa:</span>
              <span className="text-sm font-medium">
                {DAYS_OF_WEEK[wizardData.longRunDay as keyof typeof DAYS_OF_WEEK]}
              </span>
            </div>
          </CardContent>
        </Card>

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

        {/* Race Date (if applicable) */}
        {wizardData.hasRaceDate && wizardData.raceDate && (
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

        {/* Target Time for Race Goals */}
        {(['5k', '10k', 'half_marathon', '21k', 'marathon', '42k'].includes(wizardData.goal)) && (
          <Card className="glass-card border-accent/20 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Meta Calculada
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-center">
                <div className="font-medium text-accent text-lg">
                  Meta de Tempo Automática
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Calculamos automaticamente um tempo alvo realista baseado no seu histórico e nível atual. 
                  O objetivo será ajustado considerando o tempo disponível para treinamento.
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