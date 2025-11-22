import { useState } from 'react';
import { Lock, Users, MapPin, Activity, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AppOnboardingProps {
  onComplete: () => void;
}

export const AppOnboarding = ({ onComplete }: AppOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Step 1: Apresentação do BioPeak */}
      {currentStep === 0 && (
        <div className="flex-1 flex flex-col items-center justify-between p-6 animate-in fade-in duration-500">
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-4xl font-bold">Bem-vindo ao BioPeak</h1>
            
            <p className="text-lg text-muted-foreground">
              Seu personal coach inteligente. Treine, analise e evolua com IA.
            </p>

            <div className="grid grid-cols-1 gap-4 w-full mt-8">
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Rastreamento Inteligente</p>
                    <p className="text-sm text-muted-foreground">GPS preciso e análise em tempo real</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Planos Adaptativos</p>
                    <p className="text-sm text-muted-foreground">Treinos personalizados pela IA</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Análises Avançadas</p>
                    <p className="text-sm text-muted-foreground">Insights profundos sobre seu desempenho</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Button 
            onClick={handleNext}
            className="w-full max-w-md h-14 text-lg font-semibold"
            size="lg"
          >
            Continuar
          </Button>
        </div>
      )}

      {/* Step 2: Um esforço em equipe */}
      {currentStep === 1 && (
        <div className="flex-1 flex flex-col items-center justify-between p-6 animate-in fade-in duration-500">
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-background border-2 border-foreground flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            
            <h1 className="text-3xl font-bold leading-tight">
              Seus dados são seus
            </h1>
            
            <p className="text-base text-muted-foreground px-4">
              Os dados que você coleta no BioPeak são privados e armazenados de forma segura. Utilizamos seus dados apenas para fornecer análises personalizadas e melhorar sua experiência de treino.
            </p>

            <div className="relative w-full aspect-square max-w-sm my-8">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm" />
              <div className="absolute inset-8 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-2 w-full h-full opacity-60">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-muted rounded-lg" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-16 h-16 text-foreground" />
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground px-6">
              Seus treinos e dados de localização são protegidos e nunca compartilhados com terceiros sem sua permissão.
            </p>
          </div>

          <Button 
            onClick={handleNext}
            className="w-full max-w-md h-14 text-lg font-semibold"
            size="lg"
          >
            Continuar
          </Button>
        </div>
      )}

      {/* Step 3: Opções de privacidade */}
      {currentStep === 2 && (
        <div className="flex-1 flex flex-col items-center justify-between p-6 animate-in fade-in duration-500">
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-background border-2 border-foreground flex items-center justify-center mb-4">
              <Lock className="w-8 h-8" />
            </div>
            
            <h1 className="text-3xl font-bold leading-tight">
              Privacidade e transparência
            </h1>
            
            <p className="text-base text-muted-foreground px-4">
              Nós nos preocupamos com sua privacidade. Por padrão, mantemos seus dados seguros e privados.
            </p>

            <div className="relative w-full aspect-[4/3] max-w-sm my-6">
              <Card className="h-full bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 p-6 flex flex-col justify-center gap-4">
                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-left text-sm">
                    <p className="font-medium">Localização GPS</p>
                    <p className="text-muted-foreground">Apenas durante treinos</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <Activity className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-left text-sm">
                    <p className="font-medium">Dados de Treino</p>
                    <p className="text-muted-foreground">Armazenados com segurança</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <Lock className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-left text-sm">
                    <p className="font-medium">Compartilhamento</p>
                    <p className="text-muted-foreground">Nunca com terceiros</p>
                  </div>
                </div>
              </Card>
            </div>

            <p className="text-sm text-muted-foreground px-6">
              Você tem controle total sobre seus dados e pode gerenciar suas preferências a qualquer momento nas configurações.
            </p>
          </div>

          <Button 
            onClick={handleNext}
            className="w-full max-w-md h-14 text-lg font-semibold"
            size="lg"
          >
            Começar
          </Button>
        </div>
      )}

      {/* Indicadores de progresso */}
      <div className="flex justify-center gap-2 pb-6">
        {[0, 1, 2].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all duration-300 ${
              step === currentStep
                ? 'w-8 bg-primary'
                : 'w-2 bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
