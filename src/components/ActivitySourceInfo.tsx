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
        return null;
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