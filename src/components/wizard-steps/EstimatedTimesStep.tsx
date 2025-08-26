import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Timer, Sparkles, Edit3, CheckCircle2 } from 'lucide-react';

interface EstimatedTimesStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function EstimatedTimesStep({ wizardData, updateWizardData }: EstimatedTimesStepProps) {
  const [editingTimes, setEditingTimes] = useState(false);
  const [tempTimes, setTempTimes] = useState(wizardData.estimatedTimes);

  const distances = [
    { key: 'k5', label: '5K', distance: '5 km' },
    { key: 'k10', label: '10K', distance: '10 km' },
    { key: 'k21', label: '21K', distance: '21,1 km (Meia Maratona)' },
    { key: 'k42', label: '42K', distance: '42,2 km (Maratona)' },
  ];

  const hasEstimatedTimes = Object.values(wizardData.estimatedTimes).some(time => time);

  const handleSaveTimes = () => {
    updateWizardData({ 
      estimatedTimes: tempTimes,
      adjustedTimes: true 
    });
    setEditingTimes(false);
  };

  const formatTimeInput = (value: string) => {
    // Remove non-numeric characters except colons
    const cleaned = value.replace(/[^\d:]/g, '');
    // Ensure proper format MM:SS or HH:MM:SS
    return cleaned;
  };

  return (
    <div className="space-y-6">
      {/* Info section */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Timer className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Tempos Estimados</h3>
          <p className="text-sm text-muted-foreground">
            {hasEstimatedTimes 
              ? 'Confirme ou ajuste seus tempos estimados baseados no histórico'
              : 'Baseado no seu histórico, estimamos seus tempos atuais'
            }
          </p>
        </div>
      </div>

      {hasEstimatedTimes ? (
        <div className="space-y-4">
          {/* Auto-estimated times display */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Tempos estimados automaticamente</span>
              <Badge variant="secondary" className="text-xs">Baseado no histórico</Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {distances.map((distance) => {
                const time = wizardData.estimatedTimes[distance.key as keyof typeof wizardData.estimatedTimes];
                return (
                  <div key={distance.key} className="text-center p-3 rounded-lg bg-background/50">
                    <div className="font-bold text-lg text-primary">{time || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground">{distance.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTimes(true)}
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Ajustar tempos
              </Button>
            </div>
          </div>

          {/* Edit mode */}
          {editingTimes && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Ajustar Tempos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  {distances.map((distance) => (
                    <div key={distance.key} className="space-y-2">
                      <Label htmlFor={distance.key} className="text-sm font-medium">
                        {distance.distance}
                      </Label>
                      <Input
                        id={distance.key}
                        placeholder="Ex: 25:30 ou 1:45:20"
                        value={tempTimes[distance.key as keyof typeof tempTimes] || ''}
                        onChange={(e) => setTempTimes(prev => ({
                          ...prev,
                          [distance.key]: formatTimeInput(e.target.value)
                        }))}
                        className="text-center font-mono"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTempTimes(wizardData.estimatedTimes);
                      setEditingTimes(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTimes} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Salvar tempos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Manual time entry for users without historical data */
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Não encontramos histórico suficiente para estimar seus tempos. 
              Se você já correu essas distâncias, pode informar seus tempos abaixo (opcional).
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tempos Conhecidos (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {distances.map((distance) => (
                  <div key={distance.key} className="space-y-2">
                    <Label htmlFor={distance.key} className="text-sm font-medium">
                      {distance.distance}
                    </Label>
                    <Input
                      id={distance.key}
                      placeholder="Ex: 25:30 ou 1:45:20"
                      value={tempTimes[distance.key as keyof typeof tempTimes] || ''}
                      onChange={(e) => {
                        const newTimes = {
                          ...tempTimes,
                          [distance.key]: formatTimeInput(e.target.value)
                        };
                        setTempTimes(newTimes);
                        updateWizardData({ estimatedTimes: newTimes });
                      }}
                      className="text-center font-mono"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional info */}
      <div className="max-w-md mx-auto">
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Como usamos esses tempos?
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Definir ritmos de treino personalizados</li>
            <li>• Estabelecer metas progressivas realistas</li>
            <li>• Calcular zonas de intensidade adequadas</li>
            <li>• Adaptar a dificuldade dos exercícios</li>
          </ul>
        </div>
      </div>
    </div>
  );
}