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
      className="w-[800px] h-[600px] relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)'
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 border border-white/20 rounded-full"></div>
        <div className="absolute top-32 right-20 w-24 h-24 border border-white/10 rounded-full"></div>
        <div className="absolute bottom-20 left-32 w-16 h-16 border border-white/15 rounded-full"></div>
        <div className="absolute bottom-32 right-16 w-20 h-20 border border-white/10 rounded-full"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 p-12 h-full flex flex-col">
        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-2xl font-bold text-white">
              BioPeak
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-4">
            <div className="text-6xl">
              {getActivityEmoji(workoutData.activity_type)}
            </div>
            <div>
              <h3 className="text-3xl font-bold text-white">
                {getActivityType(workoutData.activity_type)}
              </h3>
              <p className="text-lg text-gray-300">
                Treino completado com sucesso
              </p>
            </div>
          </div>
          <div className="bg-green-500/20 text-green-300 border border-green-500/30 px-4 py-2 rounded-full flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span className="font-medium">Concluído</span>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-3 gap-8 mb-10 flex-1">
          <div className="text-center space-y-3 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex justify-center">
              <Clock className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {formatDuration(workoutData.duration_in_seconds)}
            </div>
            <div className="text-gray-300 text-lg">Duração</div>
          </div>
          
          <div className="text-center space-y-3 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex justify-center">
              <MapPin className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {formatDistance(workoutData.distance_in_meters)}
            </div>
            <div className="text-gray-300 text-lg">Distância</div>
          </div>
          
          <div className="text-center space-y-3 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex justify-center">
              <TrendingUp className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
            </div>
            <div className="text-gray-300 text-lg">Pace</div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="text-center space-y-2 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex justify-center">
              <Zap className="h-6 w-6 text-orange-400" />
            </div>
            <div className="text-xl font-semibold text-orange-300">
              {workoutData.active_kilocalories || '--'}
            </div>
            <div className="text-gray-400">kcal</div>
          </div>
          
          <div className="text-center space-y-2 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex justify-center">
              <Heart className="h-6 w-6 text-red-400" />
            </div>
            <div className="text-xl font-semibold text-red-300">
              {workoutData.average_heart_rate_in_beats_per_minute || '--'}
            </div>
            <div className="text-gray-400">bpm</div>
          </div>
          
          <div className="text-center space-y-2 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex justify-center">
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-xl font-semibold text-blue-300">
              {formatElevation(workoutData.total_elevation_gain_in_meters)}
            </div>
            <div className="text-gray-400">elevação</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-t border-white/10 pt-6">
          <p className="text-gray-300 text-lg">
            ✨ Análise inteligente de performance com BioPeak
          </p>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-8 right-8 w-3 h-3 bg-purple-400/60 rounded-full animate-pulse"></div>
      <div className="absolute bottom-8 left-8 w-2 h-2 bg-pink-400/60 rounded-full animate-pulse"></div>
      <div className="absolute top-1/2 right-12 w-2.5 h-2.5 bg-purple-300/50 rounded-full animate-pulse"></div>
    </div>
  );
};