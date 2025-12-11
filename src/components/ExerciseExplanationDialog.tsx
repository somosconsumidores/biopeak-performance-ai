import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExerciseInfo } from '@/data/strengthExercises';
import { Dumbbell, Target, ListChecks, Lightbulb, ExternalLink, ChevronRight } from 'lucide-react';

interface ExerciseExplanationDialogProps {
  exercise: ExerciseInfo | null;
  open: boolean;
  onClose: () => void;
}

export function ExerciseExplanationDialog({ exercise, open, onClose }: ExerciseExplanationDialogProps) {
  if (!exercise) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'iniciante':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediário':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'avançado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSearchVideo = () => {
    const searchTerm = exercise.videoSearchTerm || `${exercise.name} exercício execução`;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              {exercise.name}
            </DialogTitle>
            <Badge variant="outline" className={getDifficultyColor(exercise.difficulty)}>
              {exercise.difficulty}
            </Badge>
          </div>
          {exercise.alternativeNames.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Também conhecido como: {exercise.alternativeNames.join(', ')}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-sm text-foreground leading-relaxed">
                {exercise.description}
              </p>
            </CardContent>
          </Card>

          {/* Muscles Worked */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              Músculos Trabalhados
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {exercise.musclesWorked.map((muscle, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {muscle}
                </Badge>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-blue-500" />
              Como Fazer
            </h4>
            <ol className="space-y-2">
              {exercise.instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Dicas Importantes
            </h4>
            <ul className="space-y-1.5">
              {exercise.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Equipment */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-purple-500" />
              Equipamento
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {exercise.equipment.map((equip, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {equip}
                </Badge>
              ))}
            </div>
          </div>

          {/* Video Search Button */}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSearchVideo}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver vídeos de demonstração no YouTube
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
