
import { PaceHeatmap } from './PaceHeatmap';
import { Clock, Route, Activity, Heart } from 'lucide-react';
import { useActivityPaceData } from '@/hooks/useActivityPaceData';

interface WorkoutShareImageProps {
  workoutData: {
    id?: string;
    activity_type: string | null;
    duration_in_seconds: number | null;
    distance_in_meters: number | null;
    average_pace_in_minutes_per_kilometer: number | null;
    active_kilocalories: number | null;
    average_heart_rate_in_beats_per_minute: number | null;
    total_elevation_gain_in_meters: number | null;
    start_time_in_seconds: number | null;
    coordinates?: Array<{ latitude: number; longitude: number }>;
  };
}

export const WorkoutShareImage = ({ workoutData }: WorkoutShareImageProps) => {
  // Usar activity_id como fallback se id não existir  
  const activityId = workoutData.id || (workoutData as any).activity_id || '';
  const { paceData } = useActivityPaceData(activityId);
  
  // Debug log
  console.log('🔍 WORKOUT SHARE IMAGE:', {
    workoutId: workoutData.id,
    activityId: (workoutData as any).activity_id,
    finalId: activityId,
    hasCoordinates: workoutData.coordinates && workoutData.coordinates.length > 0,
    hasPaceData: !!paceData,
    coordinatesLength: workoutData.coordinates?.length || 0,
    paceDataLength: paceData?.length || 0
  });
  
  // Helper functions
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
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
    if (!paceInMinutes) return '--:--';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const formatCalories = (calories: number | null) => {
    if (!calories) return '--';
    return `${Math.round(calories)} kcal`;
  };

  const formatHeartRate = (bpm: number | null) => {
    if (!bpm) return '--';
    return `${Math.round(bpm)} bpm`;
  };

  return (
    <div 
      className="w-[1080px] h-[1920px] relative overflow-hidden"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
      }}
    >
      {/* Header with logo and activity type */}
      <div className="absolute top-12 left-0 right-0 text-center px-16">
        <div className="text-white font-bold text-7xl mb-4">
          BioPeak
        </div>
        <div className="text-white/90 font-semibold text-5xl">
          {workoutData.activity_type || 'Treino'}
        </div>
      </div>

      {/* Map container - takes up most of the middle space */}
      <div className="absolute" style={{ 
        top: '280px',
        left: '60px', 
        width: '960px',
        height: '800px',
        borderRadius: '24px',
        overflow: 'hidden',
        background: '#1e293b'
      }}>
        {workoutData.coordinates && workoutData.coordinates.length > 0 && workoutData.id && paceData && (
          <div style={{ width: '100%', height: '100%' }}>
            <PaceHeatmap 
              data={paceData}
              activityTitle={workoutData.activity_type || 'Atividade'}
            />
          </div>
        )}
        {(!workoutData.coordinates || workoutData.coordinates.length === 0 || !workoutData.id || !paceData) && (
          <div className="w-full h-full flex items-center justify-center bg-slate-700 text-white/60 text-4xl">
            Mapa não disponível
          </div>
        )}
      </div>

      {/* Metrics Grid - Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 px-16 pb-16">
        <div className="grid grid-cols-2 gap-8">
          {/* Tempo */}
          <div className="text-center bg-black/30 backdrop-blur-sm rounded-3xl py-8 px-6">
            <div className="flex items-center justify-center mb-3">
              <Clock className="w-10 h-10 text-blue-400 mr-3" />
            </div>
            <div className="text-white font-bold text-6xl mb-2">
              {formatDuration(workoutData.duration_in_seconds)}
            </div>
            <div className="text-white/80 font-medium text-3xl">
              Tempo
            </div>
          </div>

          {/* Distância */}
          <div className="text-center bg-black/30 backdrop-blur-sm rounded-3xl py-8 px-6">
            <div className="flex items-center justify-center mb-3">
              <Route className="w-10 h-10 text-green-400 mr-3" />
            </div>
            <div className="text-white font-bold text-6xl mb-2">
              {formatDistance(workoutData.distance_in_meters)}
            </div>
            <div className="text-white/80 font-medium text-3xl">
              Distância
            </div>
          </div>

          {/* Pace Médio */}
          <div className="text-center bg-black/30 backdrop-blur-sm rounded-3xl py-8 px-6">
            <div className="flex items-center justify-center mb-3">
              <Activity className="w-10 h-10 text-orange-400 mr-3" />
            </div>
            <div className="text-white font-bold text-6xl mb-2">
              {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
            </div>
            <div className="text-white/80 font-medium text-3xl">
              Pace Médio
            </div>
          </div>

          {/* FC Média */}
          <div className="text-center bg-black/30 backdrop-blur-sm rounded-3xl py-8 px-6">
            <div className="flex items-center justify-center mb-3">
              <Heart className="w-10 h-10 text-red-400 mr-3" />
            </div>
            <div className="text-white font-bold text-6xl mb-2">
              {formatHeartRate(workoutData.average_heart_rate_in_beats_per_minute)}
            </div>
            <div className="text-white/80 font-medium text-3xl">
              FC Média
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="text-white/60 font-medium text-3xl">
            📱 Acompanhe seus treinos no BioPeak
          </div>
        </div>
      </div>
    </div>
  );
};
