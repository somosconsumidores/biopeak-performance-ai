import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { SurveyCampaign, SurveyQuestion } from "@/hooks/useSurveyPopup";

interface SurveyPopupProps {
  survey: SurveyCampaign;
  onSubmit: (responses: Record<string, string>) => Promise<void>;
  onDismiss: () => void;
}

export const SurveyPopup = ({ survey, onSubmit, onDismiss }: SurveyPopupProps) => {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    // Validate required questions
    const requiredQuestions = survey.questions?.filter(q => q.is_required) || [];
    const missingResponses = requiredQuestions.filter(q => !responses[q.id]);

    if (missingResponses.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, responda todas as perguntas obrigatórias.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(responses);
      toast({
        title: "Pesquisa enviada",
        description: "Obrigado por sua participação!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar pesquisa. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    switch (question.question_type) {
      case 'text':
        return (
          <Textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Digite sua resposta..."
            className="min-h-[100px]"
          />
        );

      case 'multiple_choice':
        return (
          <RadioGroup
            value={responses[question.id] || ''}
            onValueChange={(value) => handleResponseChange(question.id, value)}
          >
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'scale':
        return (
          <RadioGroup
            value={responses[question.id] || ''}
            onValueChange={(value) => handleResponseChange(question.id, value)}
            className="flex flex-row space-x-4"
          >
            {[1, 2, 3, 4, 5].map((scale) => (
              <div key={scale} className="flex flex-col items-center space-y-1">
                <RadioGroupItem value={scale.toString()} id={`${question.id}-${scale}`} />
                <Label htmlFor={`${question.id}-${scale}`} className="text-sm">
                  {scale}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle>{survey.title}</CardTitle>
          {survey.description && (
            <CardDescription>{survey.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {survey.questions?.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {question.question_text}
                {question.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderQuestion(question)}
            </div>
          ))}
          
          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Enviando..." : "Enviar"}
            </Button>
            <Button
              variant="outline"
              onClick={onDismiss}
              disabled={isSubmitting}
            >
              Pular
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};