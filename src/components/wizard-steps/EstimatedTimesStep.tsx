import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Timer, Sparkles, Edit3, CheckCircle2 } from 'lucide-react';
import { ScrollableTimePicker } from '@/components/ui/scrollable-time-picker';

interface EstimatedTimesStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function EstimatedTimesStep({ wizardData, updateWizardData }: EstimatedTimesStepProps) {
  const [editingTimes, setEditingTimes] = useState(false);
  const [tempTimesMinutes, setTempTimesMinutes] = useState({
    k5: parseTimeToMinutes(wizardData.estimatedTimes.k5) || 30,
    k10: parseTimeToMinutes(wizardData.estimatedTimes.k10) || 50,
    k21: parseTimeToMinutes(wizardData.estimatedTimes.k21) || 120,
    k42: parseTimeToMinutes(wizardData.estimatedTimes.k42) || 240,
  });

  // Configurações de limites por distância
  const distanceConfigs = {
    k5: { label: '5K', distance: '5 km', distanceKm: 5, min: 15, max: 45, step: 0.5, format: 'MM:SS' as const, default: 30 },
    k10: { label: '10K', distance: '10 km', distanceKm: 10, min: 30, max: 90, step: 1, format: 'MM:SS' as const, default: 50 },
    k21: { label: '21K', distance: '21,1 km (Meia Maratona)', distanceKm: 21.097, min: 75, max: 240, step: 5, format: 'H:MM' as const, default: 120 },
    k42: { label: '42K', distance: '42,2 km (Maratona)', distanceKm: 42.195, min: 150, max: 480, step: 5, format: 'H:MM' as const, default: 240 },
  };

  const hasEstimatedTimes = Object.values(wizardData.estimatedTimes).some(time => time);

  // Helper para converter tempo string para minutos
  function parseTimeToMinutes(timeStr: string | undefined): number | undefined {
    if (!timeStr) return undefined;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      // MM:SS format
      const [min, sec] = parts.map(Number);
      return min + (sec / 60);
    } else if (parts.length === 3) {
      // H:MM:SS format
      const [hr, min, sec] = parts.map(Number);
      return (hr * 60) + min + (sec / 60);
    }
    return undefined;
  }

  // Helper para converter minutos para tempo string
  function formatMinutesToTime(minutes: number, format: 'MM:SS' | 'H:MM'): string {
    if (format === 'MM:SS') {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      const hrs = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hrs}:${mins.toString().padStart(2, '0')}:00`;
    }
  }

  const handleSaveTimes = () => {
    const formattedTimes = {
      k5: formatMinutesToTime(tempTimesMinutes.k5, 'MM:SS'),
      k10: formatMinutesToTime(tempTimesMinutes.k10, 'MM:SS'),
      k21: formatMinutesToTime(tempTimesMinutes.k21, 'H:MM'),
      k42: formatMinutesToTime(tempTimesMinutes.k42, 'H:MM'),
    };
    
    updateWizardData({ 
      estimatedTimes: formattedTimes,
      adjustedTimes: true 
    });
    setEditingTimes(false);
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
              {Object.entries(distanceConfigs).map(([key, config]) => {
                const time = wizardData.estimatedTimes[key as keyof typeof wizardData.estimatedTimes];
                return (
                  <div key={key} className="text-center p-3 rounded-lg bg-background/50">
                    <div className="font-bold text-lg text-primary">{time || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground">{config.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingTimes(true)}
                className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 h-auto whitespace-normal text-center"
              >
                <Edit3 className="h-4 w-4 flex-shrink-0" />
                <span>Ou defina seu tempo alvo para este plano</span>
              </Button>
            </div>
          </div>

          {/* Edit mode com TimeSpinners */}
          {editingTimes && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Definir Tempos Alvo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(distanceConfigs).map(([key, config]) => (
                  <div key={key} className="space-y-2">
                    <ScrollableTimePicker
                      value={tempTimesMinutes[key as keyof typeof tempTimesMinutes]}
                      onChange={(minutes) => setTempTimesMinutes(prev => ({
                        ...prev,
                        [key]: minutes
                      }))}
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      distance={config.distanceKm}
                      format={config.format}
                      label={config.distance}
                    />
                  </div>
                ))}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Reset to original values
                      setTempTimesMinutes({
                        k5: parseTimeToMinutes(wizardData.estimatedTimes.k5) || 30,
                        k10: parseTimeToMinutes(wizardData.estimatedTimes.k10) || 50,
                        k21: parseTimeToMinutes(wizardData.estimatedTimes.k21) || 120,
                        k42: parseTimeToMinutes(wizardData.estimatedTimes.k42) || 240,
                      });
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
        /* Manual time entry com TimeSpinners para usuários sem histórico */
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
            <CardContent className="space-y-6">
              {Object.entries(distanceConfigs).map(([key, config]) => (
                <div key={key} className="space-y-2">
                  <ScrollableTimePicker
                    value={tempTimesMinutes[key as keyof typeof tempTimesMinutes]}
                    onChange={(minutes) => {
                      const newTimesMinutes = {
                        ...tempTimesMinutes,
                        [key]: minutes
                      };
                      setTempTimesMinutes(newTimesMinutes);
                      
                      // Auto-save: converter e atualizar wizardData
                      const formattedTimes = {
                        k5: formatMinutesToTime(newTimesMinutes.k5, 'MM:SS'),
                        k10: formatMinutesToTime(newTimesMinutes.k10, 'MM:SS'),
                        k21: formatMinutesToTime(newTimesMinutes.k21, 'H:MM'),
                        k42: formatMinutesToTime(newTimesMinutes.k42, 'H:MM'),
                      };
                      updateWizardData({ estimatedTimes: formattedTimes });
                    }}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    distance={config.distanceKm}
                    format={config.format}
                    label={config.distance}
                  />
                </div>
              ))}
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