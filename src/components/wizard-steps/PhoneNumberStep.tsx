import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, MessageCircle, Calendar, HelpCircle } from 'lucide-react';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';

interface PhoneNumberStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function PhoneNumberStep({ wizardData, updateWizardData }: PhoneNumberStepProps) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Format as (XX) XXXXX-XXXX
    if (value.length <= 11) {
      if (value.length > 6) {
        value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
      } else if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      } else if (value.length > 0) {
        value = `(${value}`;
      }
    }
    
    updateWizardData({ phone: value });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Phone className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-semibold mb-2 text-foreground">
          Seu número de celular
        </h3>
        <p className="text-sm text-muted-foreground">
          O BioPeak AI Coach vai usar este número para acompanhar seu treino
        </p>
      </div>

      <div className="space-y-4">
        <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">💬 Lembretes de treino</h4>
              <p className="text-sm text-muted-foreground">
                Receba lembretes antes dos seus treinos programados
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">❓ Tire dúvidas</h4>
              <p className="text-sm text-muted-foreground">
                Converse com o coach sobre seu plano e performance
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">📅 Reagendamento</h4>
              <p className="text-sm text-muted-foreground">
                Peça para ajustar treinos quando imprevistos acontecerem
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-2 pt-4">
        <Label htmlFor="phone" className="text-base font-medium">
          Número de celular (WhatsApp)
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="(00) 00000-0000"
          value={wizardData.phone || ''}
          onChange={handlePhoneChange}
          maxLength={15}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Seu número será usado exclusivamente para comunicação do BioPeak AI Coach
        </p>
      </div>
    </div>
  );
}
