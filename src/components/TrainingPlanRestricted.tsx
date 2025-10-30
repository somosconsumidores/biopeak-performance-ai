import { Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const TrainingPlanRestricted = () => {
  const navigate = useNavigate();

  return (
    <div className="text-center py-8">
      <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Funcionalidade Premium</h3>
      <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
        O Plano de Treino Personalizado é exclusivo para assinantes BioPeak Pro
      </p>
      <Button 
        className="w-full max-w-xs"
        onClick={() => navigate('/paywall2')}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Tenho interesse em assinar
      </Button>
    </div>
  );
};
