import { useEffect, useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Bike, Waves, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StrengthParentPlanStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

interface ActivePlan {
  id: string;
  plan_name: string;
  sport_type: string;
  goal_type: string;
  start_date: string;
  end_date: string;
}

const SPORT_ICONS: Record<string, React.ElementType> = {
  running: Activity,
  cycling: Bike,
  swimming: Waves,
};

const SPORT_LABELS: Record<string, string> = {
  running: 'Corrida',
  cycling: 'Ciclismo',
  swimming: 'Natação',
};

export function StrengthParentPlanStep({ wizardData, updateWizardData }: StrengthParentPlanStepProps) {
  const { user } = useAuth();
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivePlans = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('training_plans')
        .select('id, plan_name, sport_type, goal_type, start_date, end_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('is_complementary', false)
        .in('sport_type', ['running', 'cycling', 'swimming']);

      if (!error && data) {
        setActivePlans(data);
        // Auto-select if only one plan
        if (data.length === 1 && !wizardData.parentPlanId) {
          updateWizardData({ parentPlanId: data[0].id });
        }
      }
      setLoading(false);
    };

    fetchActivePlans();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activePlans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-amber-700 dark:text-amber-400">
              Nenhum plano aeróbico ativo encontrado
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              O treino de força é um plano complementar que precisa estar associado a um plano 
              aeróbico (corrida, ciclismo ou natação) para sincronizar os dias de treino.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Crie primeiro um plano de corrida, ciclismo ou natação</strong>, e depois 
              adicione o treino de força como complemento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Selecione o plano aeróbico ao qual o treino de força será vinculado
      </p>

      <RadioGroup 
        value={wizardData.parentPlanId || ''} 
        onValueChange={(value) => updateWizardData({ parentPlanId: value })}
        className="space-y-4"
      >
        {activePlans.map((plan) => {
          const Icon = SPORT_ICONS[plan.sport_type] || Activity;
          const sportLabel = SPORT_LABELS[plan.sport_type] || plan.sport_type;
          const isSelected = wizardData.parentPlanId === plan.id;
          
          return (
            <Card 
              key={plan.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => updateWizardData({ parentPlanId: plan.id })}
            >
              <CardContent className="p-4 flex items-start space-x-4">
                <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" />
                <Icon className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1">
                  <Label htmlFor={plan.id} className="cursor-pointer">
                    <div className="font-semibold">{plan.plan_name}</div>
                    <p className="text-sm text-muted-foreground">
                      {sportLabel} • {plan.goal_type}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {format(new Date(plan.start_date), "d 'de' MMM", { locale: ptBR })} até{' '}
                      {format(new Date(plan.end_date), "d 'de' MMM", { locale: ptBR })}
                    </p>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </RadioGroup>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <strong>Por que vincular?</strong> Os treinos de força serão programados de forma 
        inteligente, evitando dias de treino aeróbico intenso e respeitando a periodização 
        do seu plano principal.
      </div>
    </div>
  );
}
