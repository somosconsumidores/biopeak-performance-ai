import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  Utensils, 
  Scale,
  Zap,
  Dumbbell,
  Coffee,
  Sun,
  Moon,
  RefreshCw,
  TrendingUp,
  Apple,
  Beef,
  Droplets,
  AlertCircle
} from 'lucide-react';
import { useNutritionalProfile } from '@/hooks/useNutritionalProfile';

// Donut chart component
function MacroDonut({ 
  value, 
  max, 
  color, 
  label, 
  grams,
  icon: Icon
}: { 
  value: number; 
  max: number; 
  color: string; 
  label: string;
  grams: number;
  icon: React.ElementType;
}) {
  const percentage = Math.round((value / max) * 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-5 w-5 mb-1" style={{ color }} />
          <span className="text-lg font-bold">{grams}g</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
      <span className="text-xs font-medium">{percentage}%</span>
    </div>
  );
}

export function NutritionDashboard() {
  const { nutritionalProfile, nutritionPlan, tomorrowWorkout, loading } = useNutritionalProfile();

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-muted/20 rounded-lg" />
        <div className="h-32 bg-muted/20 rounded-lg" />
        <div className="h-64 bg-muted/20 rounded-lg" />
      </div>
    );
  }

  if (!nutritionalProfile) {
    return null;
  }

  const { bmr, tdee, avgTrainingCalories, proteinGrams, carbsGrams, fatGrams } = nutritionalProfile;
  
  // Calculate macro percentages for display
  const totalMacroCalories = (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);

  // Determine workout intensity for tomorrow
  const isHighIntensityTomorrow = tomorrowWorkout?.workout_type?.includes('interval') || 
    tomorrowWorkout?.workout_type?.includes('tempo') ||
    tomorrowWorkout?.description?.toLowerCase().includes('intenso');

  return (
    <div className="space-y-6 pb-24">
      {/* Header - Seu Motor */}
      <Card className="glass-card border-orange-500/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-green-500" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Seu Motor
            </CardTitle>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TDEE Display */}
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-1">Gasto Calórico Diário (TDEE)</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-orange-500">{tdee.toLocaleString()}</span>
              <span className="text-lg text-muted-foreground">kcal</span>
            </div>
          </div>

          {/* Visual breakdown bar */}
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Metabolismo Basal</span>
              <span>Treinos (média)</span>
            </div>
            <div className="h-4 rounded-full bg-muted/20 overflow-hidden flex">
              <div 
                className="h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all"
                style={{ width: `${(bmr / tdee) * 100}%` }}
              />
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
                style={{ width: `${(avgTrainingCalories / tdee) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>{bmr} kcal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>+{avgTrainingCalories} kcal</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center bg-muted/10 rounded-lg p-3">
            <Zap className="h-3 w-3 inline mr-1 text-amber-500" />
            Isso é o que você queima apenas para existir e treinar. É a base do seu plano.
          </p>
        </CardContent>
      </Card>

      {/* Macro Distribution */}
      <Card className="glass-card border-green-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-green-500" />
              Plano Macro
            </CardTitle>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              Performance
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Donut Charts */}
          <div className="flex justify-around py-4">
            <MacroDonut
              value={carbsGrams * 4}
              max={totalMacroCalories}
              color="#f59e0b"
              label="Carboidratos"
              grams={carbsGrams}
              icon={Apple}
            />
            <MacroDonut
              value={proteinGrams * 4}
              max={totalMacroCalories}
              color="#ef4444"
              label="Proteínas"
              grams={proteinGrams}
              icon={Beef}
            />
            <MacroDonut
              value={fatGrams * 9}
              max={totalMacroCalories}
              color="#3b82f6"
              label="Gorduras"
              grams={fatGrams}
              icon={Droplets}
            />
          </div>

          {/* Goal badge */}
          <div className="flex items-center justify-center gap-2 py-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Foco: Performance Atlética</span>
          </div>
        </CardContent>
      </Card>

      {/* Meal Suggestions */}
      <Card className="glass-card border-amber-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Utensils className="h-5 w-5 text-amber-500" />
              Exemplo de Dia Ideal
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nutritionPlan?.insight_data ? (
            <div className="space-y-3">
              <MealItem
                icon={Coffee}
                label="Café da Manhã"
                description={nutritionPlan.insight_data.breakfast || 'Aveia com frutas e whey protein'}
                color="text-amber-600"
              />
              <MealItem
                icon={Sun}
                label="Almoço"
                description={nutritionPlan.insight_data.lunch || 'Arroz, feijão, frango grelhado, salada verde'}
                color="text-yellow-500"
              />
              <MealItem
                icon={Dumbbell}
                label="Pré-Treino"
                description={nutritionPlan.insight_data.pre_workout || 'Banana com pasta de amendoim'}
                color="text-orange-500"
              />
              <MealItem
                icon={Moon}
                label="Jantar"
                description={nutritionPlan.insight_data.dinner || 'Peixe com batata doce e legumes'}
                color="text-slate-400"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <MealItem
                icon={Coffee}
                label="Café da Manhã"
                description="Aveia com frutas, mel e whey protein"
                color="text-amber-600"
              />
              <MealItem
                icon={Sun}
                label="Almoço"
                description="Arroz integral, feijão, frango grelhado, salada verde"
                color="text-yellow-500"
              />
              <MealItem
                icon={Dumbbell}
                label="Pré-Treino"
                description="Banana com pasta de amendoim e mel"
                color="text-orange-500"
              />
              <MealItem
                icon={Moon}
                label="Jantar"
                description="Salmão com batata doce e brócolis"
                color="text-slate-400"
              />
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Gerar Novo Plano
          </Button>
        </CardContent>
      </Card>

      {/* Tomorrow Workout Integration */}
      {tomorrowWorkout && (
        <Card className={`glass-card ${isHighIntensityTomorrow ? 'border-red-500/30' : 'border-blue-500/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${isHighIntensityTomorrow ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                <AlertCircle className={`h-5 w-5 ${isHighIntensityTomorrow ? 'text-red-500' : 'text-blue-500'}`} />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-1">Treino de Amanhã</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  {tomorrowWorkout.workout_type || 'Treino programado'}
                </p>
                {isHighIntensityTomorrow ? (
                  <p className="text-xs bg-red-500/10 text-red-400 p-2 rounded-lg">
                    <Zap className="h-3 w-3 inline mr-1" />
                    Treino intenso amanhã! Aumente os carboidratos no jantar de hoje.
                  </p>
                ) : (
                  <p className="text-xs bg-blue-500/10 text-blue-400 p-2 rounded-lg">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    Mantenha sua alimentação equilibrada para amanhã.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MealItem({ 
  icon: Icon, 
  label, 
  description, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
      <div className={`p-2 rounded-lg bg-background/50 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </div>
  );
}
