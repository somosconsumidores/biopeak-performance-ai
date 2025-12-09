import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  Coffee, 
  Sun, 
  Apple, 
  Moon, 
  ShoppingCart,
  Sparkles,
  Dumbbell
} from 'lucide-react';

interface DayMeals {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
}

interface WeeklyMenuDay {
  day: string;
  meals: DayMeals;
}

interface NutritionalPlanData {
  summary: string;
  weekly_menu: WeeklyMenuDay[];
  shopping_list: string[];
}

const mealConfig = [
  { key: 'breakfast', label: 'Café da Manhã', icon: Coffee, gradient: 'from-amber-500 to-orange-500' },
  { key: 'lunch', label: 'Almoço', icon: Sun, gradient: 'from-yellow-500 to-amber-500' },
  { key: 'snack', label: 'Lanche', icon: Apple, gradient: 'from-green-500 to-emerald-500' },
  { key: 'dinner', label: 'Jantar', icon: Moon, gradient: 'from-indigo-500 to-purple-500' }
] as const;

export function NutritionWeeklyPlan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState<NutritionalPlanData | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [activeDay, setActiveDay] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchNutritionalPlan();
    }
  }, [user]);

  const fetchNutritionalPlan = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_coach_insights_history')
        .select('insight_data')
        .eq('user_id', user.id)
        .eq('insight_type', 'nutritional_plan_weekly')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.insight_data) {
        const parsed = data.insight_data as NutritionalPlanData;
        setPlanData(parsed);
        if (parsed.weekly_menu?.length > 0) {
          setActiveDay(parsed.weekly_menu[0].day);
        }
      }
    } catch (err) {
      console.error('Error fetching nutritional plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToTrainingPlan = () => {
    navigate('/training-plan');
  };

  const toggleCheckItem = (item: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!planData) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Plano Nutricional Personalizado</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Receba um cardápio semanal completo, adaptado ao seu perfil de atleta e plano de treino.
              </p>
            </div>
            <Button 
              onClick={handleGoToTrainingPlan} 
              className="mt-4"
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Gerar Meu Plano de Treino
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strategy Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary mb-1">Estratégia da Semana</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {planData.summary}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Tabs */}
      <Tabs value={activeDay} onValueChange={setActiveDay} className="w-full">
        <TabsList className="w-full h-auto p-1 bg-muted/30 overflow-x-auto flex-nowrap justify-start gap-1">
          {planData.weekly_menu.map((day) => {
            const shortDay = day.day.substring(0, 3);
            return (
              <TabsTrigger
                key={day.day}
                value={day.day}
                className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span className="hidden sm:inline">{day.day}</span>
                <span className="sm:hidden">{shortDay}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {planData.weekly_menu.map((day) => (
          <TabsContent key={day.day} value={day.day} className="mt-4">
            <div className="grid grid-cols-1 gap-3">
              {mealConfig.map((meal) => {
                const IconComponent = meal.icon;
                const mealText = day.meals[meal.key];
                
                return (
                  <Card key={meal.key} className="glass-card border-glass-border overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3 p-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meal.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <IconComponent className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold mb-1">{meal.label}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {mealText}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Shopping List Accordion */}
      {planData.shopping_list && planData.shopping_list.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="shopping-list" className="border rounded-xl overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="font-medium text-sm">
                  Lista de Compras ({planData.shopping_list.length} itens)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2 pt-2">
                {planData.shopping_list.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => toggleCheckItem(item)}
                  >
                    <Checkbox 
                      checked={checkedItems.has(item)}
                      onCheckedChange={() => toggleCheckItem(item)}
                    />
                    <span className={`text-sm ${checkedItems.has(item) ? 'line-through text-muted-foreground' : ''}`}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  {checkedItems.size} de {planData.shopping_list.length} itens marcados
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
