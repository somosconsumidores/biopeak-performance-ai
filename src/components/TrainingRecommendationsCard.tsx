import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTrainingRecommendations } from '@/hooks/useTrainingRecommendations';
import { useCommitments } from '@/hooks/useCommitments';
import { 
  Target, 
  Calendar, 
  Clock, 
  Zap, 
  Heart, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Trophy,
  MapPin,
  BookOpen
} from 'lucide-react';

const TrainingRecommendationsCard = () => {
  const { recommendations, loading, error, refreshRecommendations } = useTrainingRecommendations();
  const { applyRecommendation } = useCommitments();
  const [activeTab, setActiveTab] = useState('recommendations');

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="font-semibold mb-2">Gerando Recomendações de Treino</h3>
              <p className="text-sm text-muted-foreground">
                Analisando seu histórico e criando um plano personalizado...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card border-glass-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center">
              <h3 className="font-semibold mb-2">Erro ao Carregar Recomendações</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={refreshRecommendations} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) {
    return null;
  }

  const getWorkoutIcon = (type: string) => {
    switch (type) {
      case 'workout': return <Zap className="h-5 w-5" />;
      case 'recovery': return <Heart className="h-5 w-5" />;
      case 'plan': return <Calendar className="h-5 w-5" />;
      case 'goal': return <Target className="h-5 w-5" />;
      default: return <BookOpen className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'outline';
      default: return 'secondary';
    }
  };

  const weekDays = [
    { key: 'monday', label: 'Segunda' },
    { key: 'tuesday', label: 'Terça' },
    { key: 'wednesday', label: 'Quarta' },
    { key: 'thursday', label: 'Quinta' },
    { key: 'friday', label: 'Sexta' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span>Recomendações de Treino IA</span>
          </div>
          <Button 
            onClick={refreshRecommendations} 
            variant="ghost" 
            size="sm"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recommendations">Treinos</TabsTrigger>
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
            <TabsTrigger value="focus">Foco</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-4">
            <div className="grid gap-4">
              {recommendations.recommendations.map((rec, index) => (
                <div key={index} className="p-4 glass-card rounded-lg space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-full bg-primary/20">
                        {getWorkoutIcon(rec.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold">{rec.title}</h3>
                          <Badge variant={getPriorityColor(rec.priority)} className="text-xs">
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                        
                        {rec.workoutDetails && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex items-center space-x-1 text-xs">
                              <Clock className="h-3 w-3" />
                              <span>{rec.workoutDetails.duration}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-xs">
                              <Heart className="h-3 w-3" />
                              <span>{rec.workoutDetails.intensity}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1">Benefícios:</h4>
                            <div className="flex flex-wrap gap-1">
                              {rec.benefits.map((benefit, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {benefit}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          <div className="p-2 rounded bg-muted/20 border border-muted">
                            <p className="text-xs text-muted-foreground">
                              <strong>Justificativa:</strong> {rec.reasoning}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => applyRecommendation({
                        title: rec.title,
                        description: rec.description,
                        priority: rec.priority,
                        category: rec.category
                      })}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aplicar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <div className="space-y-3">
              {weekDays.map(day => (
                <div key={day.key} className="flex items-center space-x-4 p-3 glass-card rounded-lg">
                  <div className="w-16 text-sm font-medium text-center">
                    {day.label}
                  </div>
                  <div className="flex-1 text-sm">
                    {recommendations.weeklyPlan[day.key as keyof typeof recommendations.weeklyPlan]}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="focus" className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Áreas de Foco</span>
              </h3>
              {recommendations.focusAreas.map((area, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 glass-card rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm">{area}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <div className="p-4 glass-card rounded-lg space-y-4">
              <div className="flex items-center space-x-2 mb-3">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Próxima Meta Sugerida</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">{recommendations.nextGoal.suggestion}</h4>
                  <p className="text-sm text-muted-foreground">
                    Prazo: {recommendations.nextGoal.timeframe}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Passos para Alcançar:</h4>
                  <div className="space-y-2">
                    {recommendations.nextGoal.steps.map((step, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-primary font-medium text-sm">{index + 1}.</span>
                        <span className="text-sm text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4"
                  onClick={() => applyRecommendation({
                    title: recommendations.nextGoal.suggestion,
                    description: `Meta com prazo de ${recommendations.nextGoal.timeframe}`,
                    priority: 'high',
                    category: 'Meta IA'
                  })}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Definir como Meta
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TrainingRecommendationsCard;