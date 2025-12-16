import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrainingWorkout, TrainingPlan } from '@/hooks/useActiveTrainingPlans';
import { format, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, AlertTriangle, ArrowRightLeft, Trash2, ArrowRight, Loader2 } from 'lucide-react';

interface RescheduleWorkoutDialogProps {
  workout: TrainingWorkout | null;
  plan: TrainingPlan | null;
  allWorkouts: TrainingWorkout[];
  open: boolean;
  onClose: () => void;
  onReschedule: (workoutId: string, newDate: string, strategy: 'swap' | 'replace' | 'push') => Promise<void>;
}

type ConflictStrategy = 'swap' | 'replace' | 'push';

export function RescheduleWorkoutDialog({ 
  workout, 
  plan, 
  allWorkouts,
  open, 
  onClose,
  onReschedule 
}: RescheduleWorkoutDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [strategy, setStrategy] = useState<ConflictStrategy>('swap');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedDate(undefined);
      setStrategy('swap');
      setIsSubmitting(false);
      onClose();
    }
  };

  // Get workouts for the same plan to show conflicts
  const planWorkouts = useMemo(() => {
    if (!plan) return [];
    return allWorkouts.filter(w => w.plan_id === plan.id && w.id !== workout?.id);
  }, [allWorkouts, plan, workout]);

  // Check if selected date has a conflict
  const conflictingWorkout = useMemo(() => {
    if (!selectedDate) return null;
    return planWorkouts.find(w => isSameDay(parseISO(w.workout_date), selectedDate));
  }, [selectedDate, planWorkouts]);

  // Date range for the calendar
  const dateRange = useMemo(() => {
    if (!plan) return { from: new Date(), to: new Date() };
    return {
      from: parseISO(plan.start_date),
      to: parseISO(plan.end_date)
    };
  }, [plan]);

  // Dates that have workouts (for visual indication)
  const workoutDates = useMemo(() => {
    return planWorkouts.map(w => parseISO(w.workout_date));
  }, [planWorkouts]);

  const handleSubmit = async () => {
    if (!workout || !selectedDate) return;
    
    setIsSubmitting(true);
    try {
      const newDateStr = format(selectedDate, 'yyyy-MM-dd');
      await onReschedule(workout.id, newDateStr, strategy);
      handleOpenChange(false);
    } catch (error) {
      console.error('Error rescheduling workout:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modifier for days with workouts
  const modifiers = {
    hasWorkout: workoutDates,
    currentWorkout: workout ? [parseISO(workout.workout_date)] : []
  };

  const modifiersStyles = {
    hasWorkout: {
      backgroundColor: 'hsl(var(--muted))',
      fontWeight: 'bold' as const
    },
    currentWorkout: {
      backgroundColor: 'hsl(var(--primary) / 0.2)',
      border: '2px solid hsl(var(--primary))'
    }
  };

  if (!workout || !plan) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Reagendar Treino
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current workout info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">{workout.title}</p>
            <p className="text-xs text-muted-foreground">
              Data atual: {format(parseISO(workout.workout_date), "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>

          {/* Calendar */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                // Disable dates outside plan range
                if (!isWithinInterval(date, { start: dateRange.from, end: dateRange.to })) {
                  return true;
                }
                // Disable current workout date
                if (isSameDay(date, parseISO(workout.workout_date))) {
                  return true;
                }
                return false;
              }}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border pointer-events-auto"
              locale={ptBR}
            />
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs justify-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted border"></div>
              <span className="text-muted-foreground">Dias com treino</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded border-2 border-primary bg-primary/20"></div>
              <span className="text-muted-foreground">Treino atual</span>
            </div>
          </div>

          {/* Conflict warning and strategy selection */}
          {conflictingWorkout && (
            <div className="space-y-3">
              <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Já existe um treino em {format(selectedDate!, "dd/MM")}: <strong>{conflictingWorkout.title}</strong>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Como resolver o conflito?</Label>
                <RadioGroup 
                  value={strategy} 
                  onValueChange={(v) => setStrategy(v as ConflictStrategy)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="swap" id="swap" />
                    <Label htmlFor="swap" className="flex items-center gap-2 cursor-pointer flex-1">
                      <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">Trocar</p>
                        <p className="text-xs text-muted-foreground">Inverter as datas dos dois treinos</p>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="push" id="push" />
                    <Label htmlFor="push" className="flex items-center gap-2 cursor-pointer flex-1">
                      <ArrowRight className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium text-sm">Empurrar</p>
                        <p className="text-xs text-muted-foreground">Mover o treino existente para o dia seguinte</p>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="replace" id="replace" />
                    <Label htmlFor="replace" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="font-medium text-sm">Substituir</p>
                        <p className="text-xs text-muted-foreground">Remover o treino existente</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Selected date confirmation */}
          {selectedDate && !conflictingWorkout && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Nova data: <strong>{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedDate || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reagendando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
