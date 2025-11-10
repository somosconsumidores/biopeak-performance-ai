import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Info, Zap } from 'lucide-react';

interface FTPStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function FTPStep({ wizardData, updateWizardData }: FTPStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
        <Zap className="h-5 w-5 text-primary mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold mb-1">O que é FTP?</div>
          <div className="text-muted-foreground">
            FTP (Functional Threshold Power) é a potência máxima que você consegue sustentar 
            por 1 hora. É a base para calcular suas zonas de treino.
          </div>
        </div>
      </div>

      <RadioGroup
        value={wizardData.hasFtpTest ? 'yes' : 'no'}
        onValueChange={(value) => {
          updateWizardData({ 
            hasFtpTest: value === 'yes',
            ftpWatts: value === 'no' ? undefined : wizardData.ftpWatts
          });
        }}
        className="space-y-3"
      >
        <Card 
          className={`cursor-pointer transition-all ${
            wizardData.hasFtpTest 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateWizardData({ hasFtpTest: true })}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="yes" id="ftp-yes" />
              <Label htmlFor="ftp-yes" className="cursor-pointer font-medium">
                Sim, eu sei meu FTP
              </Label>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${
            !wizardData.hasFtpTest && wizardData.hasFtpTest !== undefined
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-muted/50'
          }`}
          onClick={() => updateWizardData({ hasFtpTest: false, ftpWatts: undefined })}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="no" id="ftp-no" />
              <Label htmlFor="ftp-no" className="cursor-pointer font-medium">
                Não, preciso estimar
              </Label>
            </div>
          </CardContent>
        </Card>
      </RadioGroup>
      
      {wizardData.hasFtpTest && (
        <div className="space-y-2">
          <Label htmlFor="ftp-watts" className="text-sm font-medium">
            FTP em Watts
          </Label>
          <Input
            id="ftp-watts"
            type="number"
            placeholder="Ex: 250"
            min="50"
            max="600"
            value={wizardData.ftpWatts || ''}
            onChange={(e) => updateWizardData({ 
              ftpWatts: parseInt(e.target.value) || undefined 
            })}
            className="text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Valores típicos: Iniciante 150-200W, Intermediário 200-280W, Avançado 280W+
          </p>
        </div>
      )}
      
      {wizardData.hasFtpTest === false && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Vamos estimar seu FTP baseado no seu nível de ciclismo. 
            Você pode fazer um teste de FTP depois para refinar o plano.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}