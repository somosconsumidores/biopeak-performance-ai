import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { 
  Star, 
  Zap, 
  Trophy, 
  Crown,
  Sparkles
} from 'lucide-react';

const ATHLETE_LEVELS = [
  {
    id: 'Beginner',
    label: 'Iniciante',
    description: 'Estou começando minha jornada na corrida',
    details: 'Menos de 6 meses correndo regularmente, distância máxima < 5km',
    icon: Star,
    color: 'bg-green-500/10 text-green-700 dark:text-green-400'
  },
  {
    id: 'Intermediate',
    label: 'Intermediário',
    description: 'Corro regularmente mas sem consistência',
    details: '6 meses a 2 anos, distâncias até 10km, 2-3x por semana',
    icon: Zap,
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  },
  {
    id: 'Advanced',
    label: 'Avançado',
    description: 'Corro consistentemente e monitoro performance',
    details: 'Mais de 2 anos, distâncias 10km+, treino estruturado 4-5x/semana',
    icon: Trophy,
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
  },
  {
    id: 'Elite',
    label: 'Elite',
    description: 'Participo de competições e busco melhorar marcas',
    details: 'Atleta competitivo, treino diário, objetivos de tempo específicos',
    icon: Crown,
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  },
];

interface AthleteLevelStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function AthleteLevelStep({ wizardData, updateWizardData }: AthleteLevelStepProps) {
  const handleLevelChange = (level: string) => {
    updateWizardData({ 
      athleteLevel: level as any,
      adjustedLevel: true // Mark that user manually adjusted level
    });
  };

  return (
    <div className="space-y-6">
      {/* Auto-detected level info */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">Nível detectado automaticamente</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Baseado no seu histórico de atividades, identificamos você como{' '}
          <Badge variant="secondary" className={ATHLETE_LEVELS.find(l => l.id === wizardData.athleteLevel)?.color}>
            {ATHLETE_LEVELS.find(l => l.id === wizardData.athleteLevel)?.label}
          </Badge>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Você pode confirmar ou ajustar seu nível abaixo se necessário.
        </p>
      </div>

      <RadioGroup 
        value={wizardData.athleteLevel} 
        onValueChange={handleLevelChange}
        className="space-y-3"
      >
        <div className="space-y-3">
          {ATHLETE_LEVELS.map((level) => {
            const Icon = level.icon;
            return (
              <Card 
                key={level.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  wizardData.athleteLevel === level.id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleLevelChange(level.id)}
              >
                <CardContent className="flex items-start space-x-3 p-4">
                  <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={level.id}
                      className="flex items-start space-x-3 cursor-pointer"
                    >
                      <div className={`p-2 rounded-lg ${level.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {level.label}
                          {wizardData.athleteLevel === level.id && !wizardData.adjustedLevel && (
                            <Badge variant="outline" className="text-xs">
                              Detectado
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {level.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {level.details}
                        </div>
                      </div>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </RadioGroup>
    </div>
  );
}