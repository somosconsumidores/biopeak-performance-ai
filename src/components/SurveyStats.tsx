import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface SurveyStatsProps {
  campaignId: string;
}

interface Stats {
  totalInteractions: number;
  totalResponses: number;
  totalDismissals: number;
  responseRate: number;
  questionStats: Array<{
    question_text: string;
    question_type: string;
    responses: Array<{
      response_text?: string;
      response_option?: string;
      count: number;
    }>;
  }>;
}

export const SurveyStats = ({ campaignId }: SurveyStatsProps) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [campaignId]);

  const fetchStats = async () => {
    try {
      // Get total interactions
      const { data: interactions, error: interactionsError } = await supabase
        .from('survey_user_interactions')
        .select('action')
        .eq('campaign_id', campaignId);

      if (interactionsError) throw interactionsError;

      const totalInteractions = interactions?.length || 0;
      const totalResponses = interactions?.filter(i => i.action === 'responded').length || 0;
      const totalDismissals = interactions?.filter(i => i.action === 'dismissed').length || 0;
      const responseRate = totalInteractions > 0 ? (totalResponses / totalInteractions) * 100 : 0;

      // Get questions and their responses
      const { data: questions, error: questionsError } = await supabase
        .from('survey_questions')
        .select(`
          question_text,
          question_type,
          id
        `)
        .eq('campaign_id', campaignId)
        .order('order_index');

      if (questionsError) throw questionsError;

      const questionStats = [];
      for (const question of questions || []) {
        const { data: responses, error: responsesError } = await supabase
          .from('survey_responses')
          .select('response_text, response_option')
          .eq('question_id', question.id);

        if (responsesError) throw responsesError;

        // Group responses
        const responseGroups: Record<string, number> = {};
        responses?.forEach(response => {
          const key = response.response_text || response.response_option || 'Sem resposta';
          responseGroups[key] = (responseGroups[key] || 0) + 1;
        });

        const groupedResponses = Object.entries(responseGroups).map(([text, count]) => ({
          response_text: text,
          count
        }));

        questionStats.push({
          question_text: question.question_text,
          question_type: question.question_type,
          responses: groupedResponses
        });
      }

      setStats({
        totalInteractions,
        totalResponses,
        totalDismissals,
        responseRate,
        questionStats
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center">Carregando estatísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center">Erro ao carregar estatísticas.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Visualizações</CardDescription>
            <CardTitle className="text-2xl">{stats.totalInteractions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Respostas</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.totalResponses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejeitadas</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.totalDismissals}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Resposta</CardDescription>
            <CardTitle className="text-2xl">{stats.responseRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.responseRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Respostas por Pergunta</h3>
        {stats.questionStats.map((question, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-base">{question.question_text}</CardTitle>
              <CardDescription>
                Tipo: {question.question_type === 'text' ? 'Texto Livre' : 
                       question.question_type === 'multiple_choice' ? 'Múltipla Escolha' : 'Escala'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {question.responses.length > 0 ? (
                  question.responses.map((response, responseIndex) => (
                    <div key={responseIndex} className="flex justify-between items-center">
                      <span className="text-sm">{response.response_text}</span>
                      <Badge variant="outline">{response.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma resposta ainda</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};