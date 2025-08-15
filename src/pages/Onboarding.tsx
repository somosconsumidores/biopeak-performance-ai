import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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
  const [birthDate, setBirthDate] = useState<Date | undefined>();
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
    const onboardingData = {
      goal: selectedGoal,
      goal_other: selectedGoal === "other" ? goalOther : undefined,
      birth_date: birthDate ? format(birthDate, "yyyy-MM-dd") : undefined,
      weight_kg: weight ? parseFloat(weight) : undefined,
      athletic_level: athleticLevel,
    };

    const success = await saveOnboardingData(onboardingData);
    if (success) {
      navigate("/garmin-sync");
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedGoal && (selectedGoal !== "other" || goalOther.trim());
      case 2:
        return birthDate;
      case 3:
        return weight && parseFloat(weight) > 0;
      case 4:
        return athleticLevel;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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

        <Card className="backdrop-blur-sm bg-card/95 border-muted">
          <CardHeader>
            <CardTitle className="text-center">
              {currentStep === 1 && "Qual é o seu objetivo?"}
              {currentStep === 2 && "Qual é a sua data de nascimento?"}
              {currentStep === 3 && "Qual é o seu peso?"}
              {currentStep === 4 && "Você se considera um atleta:"}
            </CardTitle>
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
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <CalendarIcon className="h-8 w-8 text-primary mb-4" />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-12",
                        !birthDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {birthDate ? (
                        format(birthDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione sua data de nascimento</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={birthDate}
                      onSelect={setBirthDate}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
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
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Voltar
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Próximo
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={!canProceed() || loading}
                >
                  {loading ? "Salvando..." : "Finalizar"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};