import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrainingPlanWizard } from '@/hooks/useTrainingPlanWizard';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  CheckCircle 
} from 'lucide-react';

// Step Components
import { GoalSelectionStep } from './wizard-steps/GoalSelectionStep';
import { AthleteLevelStep } from './wizard-steps/AthleteLevelStep';
import { BirthDateStep } from './wizard-steps/BirthDateStep';
import { GenderStep } from './wizard-steps/GenderStep';
import { EstimatedTimesStep } from './wizard-steps/EstimatedTimesStep';
import { WeeklyFrequencyStep } from './wizard-steps/WeeklyFrequencyStep';
import { AvailableDaysStep } from './wizard-steps/AvailableDaysStep';
import { LongRunDayStep } from './wizard-steps/LongRunDayStep';
import { StartDateStep } from './wizard-steps/StartDateStep';
import { PlanDurationStep } from './wizard-steps/PlanDurationStep';
import { RaceDateStep } from './wizard-steps/RaceDateStep';
import { SummaryStep } from './wizard-steps/SummaryStep';
import { RaceGoalStep } from './wizard-steps/RaceGoalStep';

interface TrainingPlanWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onComplete?: () => void;
}

const STEP_TITLES = [
  'Qual é seu objetivo?',
  'Confirme seu nível',
  'Data de nascimento',
  'Gênero',
  'Tempos estimados',
  'Frequência semanal',
  'Dias disponíveis',
  'Dia da corrida longa',
  'Data de início',
  'Duração do plano',
  'Data da prova',
  'Resumo e geração'
];

const STEP_DESCRIPTIONS = [
  'Escolha o objetivo principal do seu plano de treino',
  'Validamos automaticamente seu nível baseado no histórico',
  'Confirme ou atualize sua data de nascimento',
  'Informação necessária para personalização do plano',
  'Confirme ou ajuste seus tempos estimados atuais',
  'Quantos treinos por semana você quer fazer?',
  'Em quais dias da semana você pode treinar?',
  'Qual dia prefere para o treino mais longo?',
  'Quando você gostaria de começar o plano?',
  'Por quantas semanas você quer treinar?',
  'Tem alguma prova específica como objetivo?',
  'Revise tudo antes de gerar seu plano personalizado'
];

export function TrainingPlanWizard({ 
  open = true, 
  onOpenChange, 
  onClose, 
  onComplete 
}: TrainingPlanWizardProps) {
  const {
    currentStep,
    totalSteps,
    wizardData,
    loading,
    updateWizardData,
    nextStep,
    previousStep,
    canProceed,
    generateTrainingPlan,
  } = useTrainingPlanWizard();
  
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep === totalSteps) {
      handleFinish();
    } else {
      nextStep();
    }
  };

  const handleFinish = async () => {
    setIsGenerating(true);
    const success = await generateTrainingPlan();
    
    if (success) {
      toast({
        title: "Plano criado com sucesso! 🎉",
        description: "Seu plano de treino personalizado foi gerado e está sendo processado.",
      });
      onOpenChange?.(false);
      onClose?.();
      onComplete?.();
    } else {
      toast({
        title: "Erro ao criar plano",
        description: "Ocorreu um erro ao gerar seu plano. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsGenerating(false);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <GoalSelectionStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 2:
        return <AthleteLevelStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 3:
        return <BirthDateStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 4:
        return <GenderStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 5:
        return <EstimatedTimesStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 6:
        return <WeeklyFrequencyStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 7:
        return <AvailableDaysStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 8:
        return <LongRunDayStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 9:
        return <StartDateStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 10:
        return <PlanDurationStep wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 11:
        return <RaceDateStep wizardData={wizardData} updateWizardData={updateWizardData} />;
        case 12:
          return <RaceGoalStep wizardData={wizardData} onUpdate={updateWizardData} />;
        case 13:
          return <SummaryStep wizardData={wizardData} />;
        default:
          return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange?.(isOpen);
      if (!isOpen) onClose?.();
    }}>
      <DialogContent className="static-dialog w-[95vw] max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="p-6 border-b border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Criar Plano de Treino Personalizado
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {STEP_DESCRIPTIONS[currentStep - 1]}
                </p>
              </div>
            </div>
            
            {/* Progress */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">
                  Passo {currentStep} de {totalSteps}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress)}% completo
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Card className="glass-card border-0 shadow-none">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-lg font-semibold">
                  {STEP_TITLES[currentStep - 1]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderCurrentStep()}
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border bg-muted/20">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={previousStep}
                disabled={currentStep === 1 || loading || isGenerating}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>

              <div className="flex items-center gap-2">
                {currentStep === totalSteps ? (
                  <Button
                    onClick={handleFinish}
                    disabled={!canProceed || loading || isGenerating}
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold px-8"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-spin" />
                        Gerando Plano...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Gerar Plano
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed || loading}
                    className="flex items-center gap-2"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}