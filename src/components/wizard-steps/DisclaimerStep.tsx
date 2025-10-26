import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useState } from 'react';

interface DisclaimerStepProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function DisclaimerStep({ onAccept, onDecline }: DisclaimerStepProps) {
  const { updateTrainingPlanAcceptance } = useProfile();
  const [processing, setProcessing] = useState(false);

  const handleAccept = async () => {
    setProcessing(true);
    await updateTrainingPlanAcceptance(true);
    setProcessing(false);
    onAccept();
  };

  const handleDecline = async () => {
    setProcessing(true);
    await updateTrainingPlanAcceptance(false);
    setProcessing(false);
    onDecline();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2 text-foreground">
          Termos e Condições do Plano de Treino Automatizado BioPeak AI
        </h2>
        <p className="text-sm text-muted-foreground">
          Por favor, leia atentamente antes de prosseguir
        </p>
      </div>

      <div className="space-y-4">
        <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">✅ Transparência</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                As recomendações apresentadas pelo BioPeak AI Coach são geradas automaticamente com base em dados fisiológicos e algoritmos de aprendizado de máquina.
                <span className="font-medium text-foreground block mt-2">
                  Elas não substituem a orientação de um profissional de Educação Física registrado no CREF.
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-accent mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">✅ Limite de atuação da IA</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nossa IA propõe um plano de treino automatizado, mas <span className="font-medium text-foreground">não prescreve treinos personalizados clinicamente</span>.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-secondary mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">✅ LGPD e consentimento</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Os dados coletados (FC, VO₂, sono, etc.) são usados para gerar <span className="font-medium text-foreground">recomendações automatizadas de bem-estar</span> e não diagnósticos médicos.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
        <Button
          onClick={handleAccept}
          disabled={processing}
          className="flex-1 h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Estou de acordo e quero seguir
        </Button>
        
        <Button
          onClick={handleDecline}
          disabled={processing}
          variant="outline"
          className="flex-1 h-12 border-2 hover:bg-destructive/10 hover:border-destructive"
        >
          <XCircle className="h-5 w-5 mr-2" />
          Não estou de acordo
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Ao aceitar os termos, você reconhece ter lido e compreendido as condições acima.
      </p>
    </div>
  );
}
