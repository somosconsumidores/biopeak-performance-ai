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
import socialShareBg from '@/assets/social-share-bg.png';

interface WorkoutShareImageProps {
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

export const WorkoutShareImage = ({ workoutData }: WorkoutShareImageProps) => {
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
    <div 
      className="w-[800px] h-[600px] relative overflow-hidden"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundImage: `url(${socialShareBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60"></div>
      
      {/* Additional overlay in corners for branding */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/70 to-transparent"></div>
      </div>

      {/* Main content */}
      <div className="relative z-20 p-8 h-full flex flex-col">
        {/* Logo Header - positioned in top left */}
        <div className="flex justify-start mb-6">
          <div className="flex items-center space-x-3 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg border border-white/30">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-base">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              BioPeak
            </span>
          </div>
        </div>

        {/* Header - positioned on the right side */}
        <div className="flex items-start justify-end mb-8">
          <div className="text-right max-w-md">
            <div className="flex items-center justify-end space-x-4 mb-4">
              <div className="text-5xl">
                {getActivityEmoji(workoutData.activity_type)}
              </div>
              <div className="bg-green-500/90 text-white px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg">
                <Activity className="h-4 w-4" />
                <span className="font-medium text-sm">Concluído</span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
              {getActivityType(workoutData.activity_type)}
            </h3>
            <p className="text-lg text-white/90 drop-shadow">
              Treino completado com sucesso
            </p>
          </div>
        </div>

        {/* Main Metrics Grid - positioned in lower section */}
        <div className="mt-auto mb-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center space-y-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
              <div className="flex justify-center">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatDuration(workoutData.duration_in_seconds)}
              </div>
              <div className="text-gray-600 text-lg font-medium">Duração</div>
            </div>
            
            <div className="text-center space-y-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
              <div className="flex justify-center">
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatDistance(workoutData.distance_in_meters)}
              </div>
              <div className="text-gray-600 text-lg font-medium">Distância</div>
            </div>
            
            <div className="text-center space-y-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
              <div className="flex justify-center">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
              </div>
              <div className="text-gray-600 text-lg font-medium">Pace</div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2 bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow">
              <div className="flex justify-center">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {workoutData.active_kilocalories || '--'}
              </div>
              <div className="text-gray-600 text-sm font-medium">kcal</div>
            </div>
            
            <div className="text-center space-y-2 bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow">
              <div className="flex justify-center">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {workoutData.average_heart_rate_in_beats_per_minute || '--'}
              </div>
              <div className="text-gray-600 text-sm font-medium">bpm</div>
            </div>
            
            <div className="text-center space-y-2 bg-white/90 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow">
              <div className="flex justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {formatElevation(workoutData.total_elevation_gain_in_meters)}
              </div>
              <div className="text-gray-600 text-sm font-medium">elevação</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/30 shadow-lg inline-block">
            <p className="text-gray-800 text-base font-medium">
              ✨ Análise inteligente de performance com BioPeak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};