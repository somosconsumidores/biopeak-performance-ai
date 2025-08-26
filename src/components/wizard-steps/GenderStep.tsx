import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Users, Shield } from 'lucide-react';

interface GenderStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function GenderStep({ wizardData, updateWizardData }: GenderStepProps) {
  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Gênero</h3>
          <p className="text-sm text-muted-foreground">
            Necessário para personalização de zonas de treino e cálculos fisiológicos
          </p>
        </div>
      </div>

      {/* Gender selection */}
      <div className="max-w-sm mx-auto">
        <RadioGroup 
          value={wizardData.gender || ''} 
          onValueChange={(value) => updateWizardData({ gender: value as 'male' | 'female' })}
          className="space-y-3"
        >
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              wizardData.gender === 'male' 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => updateWizardData({ gender: 'male' })}
          >
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="male" id="male" />
              <Label htmlFor="male" className="cursor-pointer flex-1">
                <div className="font-medium text-foreground">Masculino</div>
              </Label>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              wizardData.gender === 'female' 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => updateWizardData({ gender: 'female' })}
          >
            <CardContent className="flex items-center space-x-3 p-4">
              <RadioGroupItem value="female" id="female" />
              <Label htmlFor="female" className="cursor-pointer flex-1">
                <div className="font-medium text-foreground">Feminino</div>
              </Label>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {/* Privacy info */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">
                Privacidade e Uso
              </h4>
              <p className="text-xs text-muted-foreground">
                Esta informação é usada exclusivamente para personalização do seu plano de treino 
                e não é compartilhada com terceiros.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Why we need this */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Como isso ajuda no seu treino?
          </h4>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <li>• Ajuste das zonas de frequência cardíaca</li>
            <li>• Personalização da intensidade dos treinos</li>
            <li>• Cálculos mais precisos de gasto energético</li>
            <li>• Recomendações específicas de recuperação</li>
          </ul>
        </div>
      </div>
    </div>
  );
}