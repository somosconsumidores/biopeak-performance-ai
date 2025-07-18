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
      className="w-[1080px] h-[1920px] relative overflow-hidden"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundImage: `url(${socialShareBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay matching app design */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80"></div>
      
      {/* Main content */}
      <div className="relative z-20 p-16 h-full flex flex-col">
        {/* Logo Header - glassmorphism style */}
        <div className="flex justify-center mb-16 mt-12">
          <div className="flex items-center space-x-5 px-10 py-6 rounded-3xl" 
               style={{
                 background: 'rgba(255, 255, 255, 0.1)',
                 backdropFilter: 'blur(20px)',
                 border: '1px solid rgba(255, 255, 255, 0.2)',
                 boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
               }}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                 style={{
                   background: 'linear-gradient(135deg, hsl(280, 90%, 65%), hsl(300, 80%, 70%))'
                 }}>
              <span className="text-white font-bold text-3xl">B</span>
            </div>
            <span className="text-4xl font-bold text-white">
              BioPeak
            </span>
          </div>
        </div>

        {/* Activity Header */}
        <div className="flex flex-col items-center text-center mb-20">
          <div className="text-9xl mb-8">
            {getActivityEmoji(workoutData.activity_type)}
          </div>
          <div className="space-y-6">
            <h3 className="text-6xl font-bold text-white drop-shadow-2xl">
              {getActivityType(workoutData.activity_type)}
            </h3>
            <p className="text-3xl text-white/90 drop-shadow-lg">
              Treino completado com sucesso
            </p>
            <div className="inline-flex items-center space-x-4 px-8 py-4 rounded-full"
                 style={{
                   background: 'rgba(34, 197, 94, 0.9)',
                   backdropFilter: 'blur(10px)',
                   boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
                 }}>
              <Activity className="h-8 w-8 text-white" />
              <span className="font-medium text-2xl text-white">Concluído</span>
            </div>
          </div>
        </div>

        {/* Main Metrics - glassmorphism cards in vertical layout */}
        <div className="flex-1 flex flex-col justify-center space-y-10">
          <div className="space-y-8">
            {/* Duration Card */}
            <div className="text-center space-y-6 p-12 rounded-3xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.1)',
                   backdropFilter: 'blur(20px)',
                   border: '1px solid rgba(255, 255, 255, 0.2)',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                 }}>
              <div className="flex justify-center">
                <Clock className="h-16 w-16 text-white" />
              </div>
              <div className="text-7xl font-bold text-white">
                {formatDuration(workoutData.duration_in_seconds)}
              </div>
              <div className="text-white/80 text-3xl font-medium">Duração</div>
            </div>
            
            {/* Distance Card */}
            <div className="text-center space-y-6 p-12 rounded-3xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.1)',
                   backdropFilter: 'blur(20px)',
                   border: '1px solid rgba(255, 255, 255, 0.2)',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                 }}>
              <div className="flex justify-center">
                <MapPin className="h-16 w-16 text-white" />
              </div>
              <div className="text-7xl font-bold text-white">
                {formatDistance(workoutData.distance_in_meters)}
              </div>
              <div className="text-white/80 text-3xl font-medium">Distância</div>
            </div>
            
            {/* Pace Card */}
            <div className="text-center space-y-6 p-12 rounded-3xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.1)',
                   backdropFilter: 'blur(20px)',
                   border: '1px solid rgba(255, 255, 255, 0.2)',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                 }}>
              <div className="flex justify-center">
                <TrendingUp className="h-16 w-16 text-white" />
              </div>
              <div className="text-7xl font-bold text-white">
                {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
              </div>
              <div className="text-white/80 text-3xl font-medium">Pace</div>
            </div>
          </div>

          {/* Secondary Metrics Grid */}
          <div className="grid grid-cols-3 gap-6 mt-12">
            <div className="text-center space-y-4 p-8 rounded-2xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.08)',
                   backdropFilter: 'blur(15px)',
                   border: '1px solid rgba(255, 255, 255, 0.15)',
                   boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                 }}>
              <div className="flex justify-center">
                <Zap className="h-10 w-10 text-orange-400" />
              </div>
              <div className="text-4xl font-semibold text-white">
                {workoutData.active_kilocalories || '--'}
              </div>
              <div className="text-white/70 text-xl font-medium">kcal</div>
            </div>
            
            <div className="text-center space-y-4 p-8 rounded-2xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.08)',
                   backdropFilter: 'blur(15px)',
                   border: '1px solid rgba(255, 255, 255, 0.15)',
                   boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                 }}>
              <div className="flex justify-center">
                <Heart className="h-10 w-10 text-red-400" />
              </div>
              <div className="text-4xl font-semibold text-white">
                {workoutData.average_heart_rate_in_beats_per_minute || '--'}
              </div>
              <div className="text-white/70 text-xl font-medium">bpm</div>
            </div>
            
            <div className="text-center space-y-4 p-8 rounded-2xl"
                 style={{
                   background: 'rgba(255, 255, 255, 0.08)',
                   backdropFilter: 'blur(15px)',
                   border: '1px solid rgba(255, 255, 255, 0.15)',
                   boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                 }}>
              <div className="flex justify-center">
                <BarChart3 className="h-10 w-10" style={{ color: 'hsl(280, 90%, 65%)' }} />
              </div>
              <div className="text-4xl font-semibold text-white">
                {formatElevation(workoutData.total_elevation_gain_in_meters)}
              </div>
              <div className="text-white/70 text-xl font-medium">elevação</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-12 mt-12">
          <div className="inline-block px-10 py-5 rounded-2xl"
               style={{
                 background: 'rgba(255, 255, 255, 0.1)',
                 backdropFilter: 'blur(20px)',
                 border: '1px solid rgba(255, 255, 255, 0.2)',
                 boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
               }}>
            <p className="text-white text-2xl font-medium">
              ✨ Análise inteligente de performance com BioPeak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};