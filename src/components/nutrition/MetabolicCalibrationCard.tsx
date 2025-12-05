import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Scale, Ruler, CalendarDays, Sparkles, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';

export function MetabolicCalibrationCard() {
  const { profile, updateProfile, updating } = useProfile();
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [birthDate, setBirthDate] = useState<Date | undefined>(
    profile?.birth_date ? new Date(profile.birth_date) : undefined
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: any = {};
    if (weight) updates.weight_kg = parseFloat(weight);
    if (height) updates.height_cm = parseFloat(height);
    if (birthDate) updates.birth_date = birthDate.toISOString().split('T')[0];

    await updateProfile(updates);
  };

  const isValid = weight && height && birthDate;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card border-primary/20 overflow-hidden">
        {/* Gradient header */}
        <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-green-500" />
        
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <Target className="h-8 w-8 text-orange-500" />
          </div>
          <CardTitle className="text-xl font-bold">Calibragem Metabólica</CardTitle>
          <CardDescription className="text-sm text-muted-foreground max-w-sm mx-auto">
            Para calcularmos sua taxa metabólica com precisão baseada nos seus treinos, precisamos calibrar seus dados.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weight" className="flex items-center gap-2 text-sm font-medium">
                <Scale className="h-4 w-4 text-orange-500" />
                Peso (kg)
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="Ex: 70.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-orange-500/50"
              />
            </div>

            {/* Height */}
            <div className="space-y-2">
              <Label htmlFor="height" className="flex items-center gap-2 text-sm font-medium">
                <Ruler className="h-4 w-4 text-amber-500" />
                Altura (cm)
              </Label>
              <Input
                id="height"
                type="number"
                placeholder="Ex: 175"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="bg-background/50 border-border/50 focus:border-amber-500/50"
              />
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-green-500" />
                Data de Nascimento
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-background/50 border-border/50",
                      !birthDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {birthDate ? (
                      format(birthDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione sua data de nascimento</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={birthDate}
                    onSelect={(date) => {
                      setBirthDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1920-01-01")
                    }
                    defaultMonth={birthDate || new Date(1990, 0, 1)}
                    captionLayout="dropdown-buttons"
                    fromYear={1920}
                    toYear={new Date().getFullYear()}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              type="submit"
              disabled={!isValid || updating}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              {updating ? (
                'Salvando...'
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Calibrar Meu Perfil
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Esses dados são usados exclusivamente para calcular suas necessidades calóricas e macros.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
