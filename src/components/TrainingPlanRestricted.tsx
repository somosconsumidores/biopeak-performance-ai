import { Bell, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TrainingPlanRestrictedProps {
  onNotifyClick: () => void;
  alreadyFlagged: boolean;
}

export const TrainingPlanRestricted = ({ onNotifyClick, alreadyFlagged }: TrainingPlanRestrictedProps) => {
  return (
    <div className="text-center py-8">
      <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">Funcionalidade Premium</h3>
      <p className="text-muted-foreground mb-6 text-sm md:text-base px-4">
        O Plano de Treino Personalizado é exclusivo para assinantes BioPeak Pro
      </p>
      <Button 
        className="w-full max-w-xs"
        onClick={onNotifyClick}
        disabled={alreadyFlagged}
      >
        <Bell className="h-4 w-4 mr-2" />
        {alreadyFlagged 
          ? 'Interesse registrado' 
          : 'Tenho interesse em assinar'
        }
      </Button>
    </div>
  );
};
