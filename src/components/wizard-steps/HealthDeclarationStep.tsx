import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Heart } from 'lucide-react';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';

interface HealthDeclarationStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (data: Partial<TrainingPlanWizardData>) => void;
}

const HEALTH_QUESTIONS = [
  {
    id: 'question_1_heart_problem',
    text: 'Alguma vez seu médico(a) disse que você possui algum problema cardíaco e que só pode praticar atividade física com prescrição médica?'
  },
  {
    id: 'question_2_chest_pain_during_activity',
    text: 'Você sente dor no tórax quando pratica atividade física?'
  },
  {
    id: 'question_3_chest_pain_last_3months',
    text: 'Nos últimos 3 meses você sentiu alguma dor torácica enquanto pratica atividades físicas?'
  },
  {
    id: 'question_4_balance_consciousness_loss',
    text: 'Você já perdeu o equilíbrio em função de tonturas ou perdeu a consciência enquanto praticava atividades físicas?'
  },
  {
    id: 'question_5_bone_joint_problem',
    text: 'Você tem algum problema ósseo ou articular que possa ser agravado com a prática de atividades físicas?'
  },
  {
    id: 'question_6_taking_medication',
    text: 'Você atualmente toma alguma remédio para pressão alta ou para alguma condição cardiovascular?'
  },
  {
    id: 'question_7_other_impediment',
    text: 'Você conhece alguma outra razão física que possa lhe impedir de praticar atividades físicas?'
  }
];

export function HealthDeclarationStep({ wizardData, updateWizardData }: HealthDeclarationStepProps) {
  const healthData = wizardData.healthDeclaration || {
    question_1_heart_problem: undefined,
    question_2_chest_pain_during_activity: undefined,
    question_3_chest_pain_last_3months: undefined,
    question_4_balance_consciousness_loss: undefined,
    question_5_bone_joint_problem: undefined,
    question_6_taking_medication: undefined,
    question_7_other_impediment: undefined,
    question_8_additional_info: '',
    declaration_accepted: false,
  };

  // Check if user is eligible (all answers must be false/NO)
  const hasPositiveAnswer = Object.keys(healthData)
    .filter(key => key.startsWith('question_') && key !== 'question_8_additional_info')
    .some(key => healthData[key as keyof typeof healthData] === true);

  const handleQuestionChange = (questionId: string, value: boolean) => {
    updateWizardData({
      healthDeclaration: {
        ...healthData,
        [questionId]: value,
      }
    });
  };

  const handleAdditionalInfoChange = (value: string) => {
    updateWizardData({
      healthDeclaration: {
        ...healthData,
        question_8_additional_info: value,
      }
    });
  };

  const handleDeclarationChange = (checked: boolean) => {
    updateWizardData({
      healthDeclaration: {
        ...healthData,
        declaration_accepted: checked,
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pb-4 border-b border-border">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-destructive/10">
            <Heart className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Declaração de Saúde</h3>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Para sua segurança e proteção legal, precisamos que você responda às seguintes perguntas sobre sua condição de saúde antes de gerar seu plano de treino.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {HEALTH_QUESTIONS.map((question, index) => (
          <div key={question.id} className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Label className="text-sm font-medium leading-relaxed block">
              {index + 1}. {question.text}
            </Label>
            <RadioGroup
              value={healthData[question.id as keyof typeof healthData]?.toString() || ''}
              onValueChange={(value) => handleQuestionChange(question.id, value === 'true')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id={`${question.id}-no`} />
                <Label htmlFor={`${question.id}-no`} className="font-normal cursor-pointer">
                  Não
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id={`${question.id}-yes`} />
                <Label htmlFor={`${question.id}-yes`} className="font-normal cursor-pointer">
                  Sim
                </Label>
              </div>
            </RadioGroup>
          </div>
        ))}

        {/* Question 8 - Additional Info */}
        <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
          <Label className="text-sm font-medium leading-relaxed block">
            8. Deseja informar algum outro problema de saúde, físico ou patológico, que lhe impeça de participar das atividades propostas?
            <span className="text-muted-foreground font-normal ml-2">(Opcional)</span>
          </Label>
          <Textarea
            value={healthData.question_8_additional_info || ''}
            onChange={(e) => handleAdditionalInfoChange(e.target.value)}
            placeholder="Descreva aqui se houver algo relevante..."
            className="min-h-[100px] resize-none"
          />
        </div>
      </div>

      {/* Warning Alert if any answer is YES */}
      {hasPositiveAnswer && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm leading-relaxed">
            <strong>Infelizmente não podemos gerar seu plano por segurança médica.</strong>
            <br />
            Pedimos que procure um médico especialista para autorização de atividades físicas.
          </AlertDescription>
        </Alert>
      )}

      {/* Declaration Checkbox - Only show if eligible */}
      {!hasPositiveAnswer && (
        <div className="pt-6 border-t border-border">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Checkbox
              id="health-declaration"
              checked={healthData.declaration_accepted || false}
              onCheckedChange={handleDeclarationChange}
              className="mt-1"
            />
            <Label
              htmlFor="health-declaration"
              className="text-sm font-medium leading-relaxed cursor-pointer flex-1"
            >
              Declaro que as minhas respostas são verdadeiras e me declaro apto para participar das atividades físicas propostas neste plano.
            </Label>
          </div>
        </div>
      )}

      {/* Legal Notice */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        Suas respostas serão armazenadas de forma segura para fins de proteção legal mútua.
      </div>
    </div>
  );
}
