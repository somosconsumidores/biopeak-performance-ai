import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Heart, Activity } from 'lucide-react';
import type { UnifiedActivity } from '@/hooks/useUnifiedActivityHistory';

interface ActivitySourceInfoProps {
  activity: UnifiedActivity;
  feature: 'heart_rate' | 'detailed_metrics' | 'performance_analysis';
}

export const ActivitySourceInfo = ({ activity, feature }: ActivitySourceInfoProps) => {
  const getAlertContent = () => {
    switch (activity.source) {
      case 'STRAVA':
        if (feature === 'heart_rate' && !activity.average_heart_rate_in_beats_per_minute) {
          return {
            icon: <Heart className="h-4 w-4" />,
            title: 'Dados de Frequência Cardíaca Limitados',
            description: 'Esta atividade do Strava pode não incluir dados detalhados de frequência cardíaca. Para análises completas, conecte um monitor de FC durante o treino.'
          };
        }
        if (feature === 'detailed_metrics') {
          return {
            icon: <Activity className="h-4 w-4" />,
            title: 'Métricas Limitadas - Fonte Strava',
            description: 'Algumas métricas avançadas podem não estar disponíveis para atividades do Strava. Dados básicos como distância, tempo e pace estão disponíveis.'
          };
        }
        if (feature === 'performance_analysis') {
          return {
            icon: <Info className="h-4 w-4" />,
            title: 'Análise de Performance Limitada',
            description: 'A análise completa de performance requer dados detalhados que podem não estar disponíveis nesta atividade do Strava.'
          };
        }
        break;
        
      case 'POLAR':
        return null;
        
      case 'GARMIN':
      default:
        return null; // Garmin tem dados completos
    }
    return null;
  };

  const alertContent = getAlertContent();
  
  if (!alertContent) return null;

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
      <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
        {alertContent.icon}
        <div>
          <div className="font-medium text-sm">{alertContent.title}</div>
          <AlertDescription className="text-xs mt-1 text-amber-600/80 dark:text-amber-400/80">
            {alertContent.description}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};