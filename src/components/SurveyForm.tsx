import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  id?: string;
  question_text: string;
  question_type: 'text' | 'multiple_choice' | 'scale';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface Campaign {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  survey_questions?: Question[];
}

interface SurveyFormProps {
  campaign?: Campaign | null;
  onSuccess: () => void;
}

export const SurveyForm = ({ campaign, onSuccess }: SurveyFormProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_active: false
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title,
        description: campaign.description || '',
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        is_active: campaign.is_active
      });
      setQuestions(campaign.survey_questions || []);
    } else {
      // Initialize with empty question for new campaign
      setQuestions([{
        question_text: '',
        question_type: 'text',
        is_required: true,
        order_index: 1
      }]);
    }
  }, [campaign]);

  const addQuestion = () => {
    if (questions.length >= 2) {
      toast({
        title: "Limite atingido",
        description: "Máximo de 2 perguntas por pesquisa.",
        variant: "destructive"
      });
      return;
    }

    setQuestions(prev => [...prev, {
      question_text: '',
      question_type: 'text',
      is_required: true,
      order_index: prev.length + 1
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ));
  };

  const addOption = (questionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === questionIndex) {
        const options = q.options || [];
        return { ...q, options: [...options, ''] };
      }
      return q;
    }));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === questionIndex) {
        const options = [...(q.options || [])];
        options[optionIndex] = value;
        return { ...q, options };
      }
      return q;
    }));
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i === questionIndex) {
        const options = q.options?.filter((_, oi) => oi !== optionIndex) || [];
        return { ...q, options };
      }
      return q;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate form
    if (!formData.title.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    if (questions.length === 0 || questions.some(q => !q.question_text.trim())) {
      toast({
        title: "Erro",
        description: "Todas as perguntas devem ter texto.",
        variant: "destructive"
      });
      return;
    }

    // Validate multiple choice questions have options
    const mcQuestions = questions.filter(q => q.question_type === 'multiple_choice');
    if (mcQuestions.some(q => !q.options || q.options.filter(o => o.trim()).length < 2)) {
      toast({
        title: "Erro",
        description: "Perguntas de múltipla escolha devem ter pelo menos 2 opções.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (campaign) {
        // Update existing campaign
        const { error: campaignError } = await supabase
          .from('survey_campaigns')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        if (campaignError) throw campaignError;

        // Delete existing questions and recreate them
        const { error: deleteError } = await supabase
          .from('survey_questions')
          .delete()
          .eq('campaign_id', campaign.id);

        if (deleteError) throw deleteError;

        // Insert new questions
        const questionsData = questions.map((q, index) => ({
          campaign_id: campaign.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === 'multiple_choice' ? q.options?.filter(o => o.trim()) : null,
          is_required: q.is_required,
          order_index: index + 1
        }));

        const { error: questionsError } = await supabase
          .from('survey_questions')
          .insert(questionsData);

        if (questionsError) throw questionsError;
      } else {
        // Create new campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from('survey_campaigns')
          .insert({
            ...formData,
            created_by: user.id
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        // Insert questions
        const questionsData = questions.map((q, index) => ({
          campaign_id: campaignData.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === 'multiple_choice' ? q.options?.filter(o => o.trim()) : null,
          is_required: q.is_required,
          order_index: index + 1
        }));

        const { error: questionsError } = await supabase
          .from('survey_questions')
          .insert(questionsData);

        if (questionsError) throw questionsError;
      }

      toast({
        title: "Sucesso",
        description: `Pesquisa ${campaign ? 'atualizada' : 'criada'} com sucesso.`,
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving survey:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar pesquisa.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Digite o título da pesquisa"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição opcional da pesquisa"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Data de Início *</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="end_date">Data de Fim *</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked as boolean }))}
          />
          <Label htmlFor="is_active">Ativar pesquisa</Label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Perguntas</h3>
          <Badge variant="outline">{questions.length}/2</Badge>
        </div>

        {questions.map((question, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">Pergunta {index + 1}</CardTitle>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeQuestion(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Texto da Pergunta *</Label>
                <Input
                  value={question.question_text}
                  onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                  placeholder="Digite sua pergunta"
                  required
                />
              </div>

              <div>
                <Label>Tipo de Pergunta</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(value) => updateQuestion(index, 'question_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto Livre</SelectItem>
                    <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                    <SelectItem value="scale">Escala (1-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {question.question_type === 'multiple_choice' && (
                <div>
                  <Label>Opções</Label>
                  <div className="space-y-2">
                    {question.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                          placeholder={`Opção ${optionIndex + 1}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeOption(index, optionIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(index)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Opção
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`required-${index}`}
                  checked={question.is_required}
                  onCheckedChange={(checked) => updateQuestion(index, 'is_required', checked)}
                />
                <Label htmlFor={`required-${index}`}>Pergunta obrigatória</Label>
              </div>
            </CardContent>
          </Card>
        ))}

        {questions.length < 2 && (
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Pergunta
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Salvando..." : campaign ? "Atualizar" : "Criar"} Pesquisa
        </Button>
      </div>
    </form>
  );
};