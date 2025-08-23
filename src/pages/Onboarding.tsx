import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
// Note: removed Popover imports and replaced with Select dropdowns
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Target, 
  Activity, 
  Scale, 
  TrendingUp, 
  Trophy, 
  Flag, 
  Heart, 
  MoreHorizontal, 
  Calendar as CalendarIcon,
  Weight,
  Users,
  Star,
  Zap,
  Medal
} from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";

const GOALS = [
  {
    id: "fitness",
    label: "Melhorar meu condicionamento físico",
    icon: Heart,
  },
  {
    id: "analysis",
    label: "Analisar os meus treinos",
    icon: Activity,
  },
  {
    id: "weight_loss",
    label: "Perder peso",
    icon: Scale,
  },
  {
    id: "general_training",
    label: "Treinamento em geral",
    icon: Target,
  },
  {
    id: "improve_times",
    label: "Melhorar minhas marcas",
    icon: TrendingUp,
  },
  {
    id: "specific_goal",
    label: "Treinar para um objetivo específico",
    icon: Flag,
  },
  {
    id: "lifestyle",
    label: "Mudar meus hábitos de vida",
    icon: Users,
  },
  {
    id: "other",
    label: "Outros",
    icon: MoreHorizontal,
  },
];

const ATHLETIC_LEVELS = [
  {
    id: "beginner",
    label: "Iniciante",
    description: "Estou começando minha vida atlética",
    icon: Star,
  },
  {
    id: "intermediate",
    label: "Intermediário",
    description: "Me exercito sem uma frequência específica",
    icon: Zap,
  },
  {
    id: "advanced",
    label: "Avançado",
    description: "Me exercito frequentemente e monitoro minha performance",
    icon: Trophy,
  },
  {
    id: "elite",
    label: "Elite",
    description: "Participo de competições e tenho objetivo de melhorar minhas marcas",
    icon: Medal,
  },
];

export const Onboarding = () => {
  const navigate = useNavigate();
  const { saveOnboardingData, loading } = useOnboarding();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [goalOther, setGoalOther] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthYear, setBirthYear] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [athleticLevel, setAthleticLevel] = useState<string>("");

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    console.log('🔍 ONBOARDING_PAGE: Starting finish process');
    
    const formattedBirthDate = birthDay && birthMonth && birthYear 
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : undefined;

    const onboardingData = {
      goal: selectedGoal,
      goal_other: selectedGoal === "other" ? goalOther : undefined,
      birth_date: formattedBirthDate,
      weight_kg: weight ? parseFloat(weight) : undefined,
      athletic_level: athleticLevel,
    };

    console.log('🔍 ONBOARDING_PAGE: Saving onboarding data', onboardingData);
    
    const success = await saveOnboardingData(onboardingData);
    if (success) {
      console.log('🔍 ONBOARDING_PAGE: Save successful, navigating to /sync');
      // Force navigation with replace to prevent back navigation
      navigate("/sync", { replace: true });
    } else {
      console.log('🔍 ONBOARDING_PAGE: Save failed');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!(selectedGoal && (selectedGoal !== "other" || goalOther.trim()));
      case 2:
        return !!(birthDay && birthMonth && birthYear);
      case 3:
        return !!(weight && parseFloat(weight) > 0);
      case 4:
        return !!athleticLevel;
      default:
        return false;
    }
  };

  // Generate arrays for dropdowns
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    { value: "1", label: "Janeiro" },
    { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Maio" },
    { value: "6", label: "Junho" },
    { value: "7", label: "Julho" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];
  
  const getDaysInMonth = (month: string, year: string): number[] => {
    if (!month || !year) return Array.from({ length: 31 }, (_, i) => i + 1);
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4 touch-manipulation onboarding-container">
      <div className="w-full max-w-2xl onboarding-ui">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Vamos configurar seu perfil
          </h1>
          <p className="text-muted-foreground">
            Algumas perguntas rápidas para personalizar sua experiência
          </p>
        </div>

        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Passo {currentStep} de {totalSteps}
          </p>
        </div>

        <Card className="glass-card w-full max-w-2xl mx-auto animate-fade-in">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-high-contrast">
              {currentStep === 1 && "Qual é o seu objetivo?"}
              {currentStep === 2 && "Qual é a sua data de nascimento?"}
              {currentStep === 3 && "Qual é o seu peso?"}
              {currentStep === 4 && "Você se considera um atleta:"}
            </CardTitle>
            <p className="text-sm text-medium-contrast">
              {currentStep === 1 && "Escolha o objetivo que mais combina com você"}
              {currentStep === 2 && "Essas informações nos ajudam a personalizar sua experiência"}
              {currentStep === 3 && "Usado para cálculos de performance mais precisos"}
              {currentStep === 4 && "Isso nos ajuda a adaptar as recomendações para seu nível"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Goal Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {GOALS.map((goal) => {
                      const Icon = goal.icon;
                      return (
                        <div key={goal.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={goal.id} id={goal.id} />
                          <Label
                            htmlFor={goal.id}
                            className="flex items-center space-x-3 cursor-pointer flex-1 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="text-sm font-medium">{goal.label}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
                
                {selectedGoal === "other" && (
                  <div className="mt-4">
                    <Label htmlFor="goal-other">Descreva seu objetivo:</Label>
                    <Textarea
                      id="goal-other"
                      placeholder="Digite aqui seu objetivo específico..."
                      value={goalOther}
                      onChange={(e) => setGoalOther(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Birth Date */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <CalendarIcon className="h-8 w-8 text-primary mb-4" />
                </div>
                
                <div className="space-y-4">
                  <Label className="text-base font-medium">Data de Nascimento</Label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {/* Day Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="birth-day" className="text-sm">Dia</Label>
                      <Select value={birthDay} onValueChange={setBirthDay}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {getDaysInMonth(birthMonth, birthYear).map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Month Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="birth-month" className="text-sm">Mês</Label>
                      <Select value={birthMonth} onValueChange={setBirthMonth}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Year Dropdown */}
                    <div className="space-y-2">
                      <Label htmlFor="birth-year" className="text-sm">Ano</Label>
                      <Select value={birthYear} onValueChange={setBirthYear}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {birthDay && birthMonth && birthYear && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        Data selecionada: {birthDay} de {months.find(m => m.value === birthMonth)?.label} de {birthYear}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Weight */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Weight className="h-8 w-8 text-primary mb-4" />
                </div>
                <div>
                  <Label htmlFor="weight">Peso (kg)</Label>
                  <div className="relative mt-2">
                    <Input
                      id="weight"
                      type="number"
                      placeholder="Ex: 70"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="pl-4 pr-12 h-12 text-center text-lg"
                      min="20"
                      max="300"
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Athletic Level */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <RadioGroup value={athleticLevel} onValueChange={setAthleticLevel}>
                  <div className="space-y-3">
                    {ATHLETIC_LEVELS.map((level) => {
                      const Icon = level.icon;
                      return (
                        <div key={level.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={level.id} id={level.id} />
                          <Label
                            htmlFor={level.id}
                            className="flex items-start space-x-3 cursor-pointer flex-1 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <Icon className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                            <div>
                              <div className="font-medium text-foreground">{level.label}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {level.description}
                              </div>
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="w-full sm:w-auto order-2 sm:order-1 accessible-button touch-target"
              >
                Voltar
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={cn(
                    "w-full sm:w-auto order-1 sm:order-2 accessible-button touch-target",
                    "bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold",
                    "transition-all duration-300 ease-out",
                    "hover:scale-105 hover:shadow-lg active:scale-95",
                    canProceed() 
                      ? "opacity-100 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]" 
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={!canProceed() || loading}
                  className={cn(
                    "w-full sm:w-auto order-1 sm:order-2 accessible-button touch-target",
                    "bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold",
                    "transition-all duration-300 ease-out",
                    "hover:scale-105 hover:shadow-lg active:scale-95",
                    (canProceed() && !loading)
                      ? "opacity-100 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                      : "opacity-50 cursor-not-allowed"
                  )}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Salvando...
                    </div>
                  ) : (
                    "Finalizar"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};