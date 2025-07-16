import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  MapPin, 
  Heart, 
  Zap, 
  TrendingUp, 
  BarChart3,
  Activity 
} from 'lucide-react';

interface WorkoutSharePreviewProps {
  workoutData: {
    activity_type: string | null;
    duration_in_seconds: number | null;
    distance_in_meters: number | null;
    average_pace_in_minutes_per_kilometer: number | null;
    active_kilocalories: number | null;
    average_heart_rate_in_beats_per_minute: number | null;
    total_elevation_gain_in_meters: number | null;
    start_time_in_seconds: number | null;
  };
}

export const WorkoutSharePreview = ({ workoutData }: WorkoutSharePreviewProps) => {
  // Helper functions
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number | null) => {
    if (!meters) return '--';
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatPace = (paceInMinutes: number | null) => {
    if (!paceInMinutes) return '--';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatElevation = (meters: number | null) => {
    if (!meters) return '--';
    return `${Math.round(meters)}m`;
  };

  const getActivityType = (type: string | null) => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'running': 'Corrida',
      'cycling': 'Ciclismo', 
      'walking': 'Caminhada',
      'swimming': 'Natação',
      'fitness_equipment': 'Academia'
    };
    return typeMap[type.toLowerCase()] || type;
  };

  const getActivityEmoji = (type: string | null) => {
    if (!type) return '💪';
    const emojiMap: { [key: string]: string } = {
      'running': '🏃‍♂️',
      'cycling': '🚴‍♂️',
      'walking': '🚶‍♂️',
      'swimming': '🏊‍♂️',
      'fitness_equipment': '💪'
    };
    return emojiMap[type.toLowerCase()] || '💪';
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background with animated gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/20 animate-pulse" />
      
      {/* Main preview card */}
      <div className="relative glass-card border-glass-border p-6 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="text-4xl">
              {getActivityEmoji(workoutData.activity_type)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {getActivityType(workoutData.activity_type)}
              </h3>
              <p className="text-sm text-muted-foreground">
                Treino completado com sucesso
              </p>
            </div>
          </div>
          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
            <Activity className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatDuration(workoutData.duration_in_seconds)}
            </div>
            <div className="text-xs text-muted-foreground">Duração</div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatDistance(workoutData.distance_in_meters)}
            </div>
            <div className="text-xs text-muted-foreground">Distância</div>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
            </div>
            <div className="text-xs text-muted-foreground">Pace</div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-glass-border">
          <div className="text-center space-y-1">
            <div className="flex justify-center">
              <Zap className="h-4 w-4 text-orange-400" />
            </div>
            <div className="text-sm font-semibold text-orange-400">
              {workoutData.active_kilocalories || '--'}
            </div>
            <div className="text-xs text-muted-foreground">kcal</div>
          </div>
          
          <div className="text-center space-y-1">
            <div className="flex justify-center">
              <Heart className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-sm font-semibold text-red-400">
              {workoutData.average_heart_rate_in_beats_per_minute || '--'}
            </div>
            <div className="text-xs text-muted-foreground">bpm</div>
          </div>
          
          <div className="text-center space-y-1">
            <div className="flex justify-center">
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-sm font-semibold text-blue-400">
              {formatElevation(workoutData.total_elevation_gain_in_meters)}
            </div>
            <div className="text-xs text-muted-foreground">elevação</div>
          </div>
        </div>

        {/* Logo branding */}
        <div className="mt-6 pt-4 border-t border-glass-border text-center">
          <div className="flex items-center justify-center space-x-3">
            <img 
              src="/lovable-uploads/a86de37b-65f7-4f6c-bf8b-80abd070a45e.png" 
              alt="Logo" 
              className="w-8 h-8 object-contain filter brightness-110"
            />
            <span className="text-sm font-semibold bg-gradient-primary bg-clip-text text-transparent">
              BioPeak
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Análise inteligente de performance
          </p>
        </div>

        {/* Floating particles effect */}
        <div className="absolute top-4 right-4 w-2 h-2 bg-primary/40 rounded-full animate-ping" />
        <div className="absolute bottom-4 left-4 w-1 h-1 bg-accent/40 rounded-full animate-pulse" />
        <div className="absolute top-1/2 right-8 w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce" />
      </div>
    </div>
  );
};