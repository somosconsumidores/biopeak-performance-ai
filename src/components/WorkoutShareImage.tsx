
import { SharePaceHeatmap } from './SharePaceHeatmap';
import { Clock, Route, Activity, Heart } from 'lucide-react';
import { useActivityPaceData } from '@/hooks/useActivityPaceData';

interface WorkoutShareImageProps {
  workoutData: {
    id?: string;
    activity_id?: string;
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
  // CRITICAL: Use activity_id (Garmin ID) for data fetching as it has the actual GPS/chart data
  const activityId = workoutData.activity_id || workoutData.id || '';
  const { paceData } = useActivityPaceData(activityId);
  
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

  const formatHeartRate = (bpm: number | null) => {
    if (!bpm) return '--';
    return `${Math.round(bpm)} bpm`;
  };

  return (
    <div 
      className="w-[1080px] h-[1920px] relative overflow-hidden"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f8fafc'
      }}
    >
      {/* Logo no topo - maior */}
      <div className="absolute top-16 left-0 right-0 text-center">
        <img 
          src="/lovable-uploads/b1bd9b87-afb9-479a-ab3c-563049af276a.png" 
          alt="BioPeak Logo" 
          className="w-72 h-72 mx-auto object-contain filter drop-shadow-lg"
        />
      </div>

      {/* Map container - sem percentis - ocupa mais espaço */}
      <div 
        className="absolute overflow-hidden"
        style={{ 
          top: '320px',
          left: '0px', 
          width: '1080px',
          height: '1000px',
          background: '#f1f5f9'
        }}
      >
        {workoutData.coordinates && workoutData.coordinates.length > 0 && workoutData.id && paceData && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Mapa sem UI - só o mapa */}
            <div style={{ width: '100%', height: '100%' }}>
              <SharePaceHeatmap 
                data={paceData}
              />
            </div>
          </div>
        )}
        {(!workoutData.coordinates || workoutData.coordinates.length === 0 || !workoutData.id || !paceData) && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-6xl">
            Mapa não disponível
          </div>
        )}

        {/* Stats overlay - sem bordas nem margens */}
        <div className="absolute bottom-24 left-0 right-0 px-12">
          <div className="grid grid-cols-2 gap-6">
            {/* Tempo */}
            <div className="text-center bg-white/90 backdrop-blur-sm py-10 px-8 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <Clock className="w-12 h-12 text-blue-600" />
              </div>
              <div className="text-gray-900 font-black text-7xl mb-3">
                {formatDuration(workoutData.duration_in_seconds)}
              </div>
              <div className="text-gray-600 font-semibold text-4xl">
                Tempo
              </div>
            </div>

            {/* Distância */}
            <div className="text-center bg-white/90 backdrop-blur-sm py-10 px-8 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <Route className="w-12 h-12 text-green-600" />
              </div>
              <div className="text-gray-900 font-black text-7xl mb-3">
                {formatDistance(workoutData.distance_in_meters)}
              </div>
              <div className="text-gray-600 font-semibold text-4xl">
                Distância
              </div>
            </div>

            {/* Pace Médio */}
            <div className="text-center bg-white/90 backdrop-blur-sm py-10 px-8 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <Activity className="w-12 h-12 text-orange-600" />
              </div>
              <div className="text-gray-900 font-black text-7xl mb-3">
                {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
              </div>
              <div className="text-gray-600 font-semibold text-4xl">
                Pace Médio
              </div>
            </div>

            {/* FC Média */}
            <div className="text-center bg-white/90 backdrop-blur-sm py-10 px-8 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <Heart className="w-12 h-12 text-red-600" />
              </div>
              <div className="text-gray-900 font-black text-7xl mb-3">
                {formatHeartRate(workoutData.average_heart_rate_in_beats_per_minute)}
              </div>
              <div className="text-gray-600 font-semibold text-4xl">
                FC Média
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <div className="text-gray-600 font-semibold text-4xl flex items-center justify-center">
          📱 Acompanhe seus treinos no BioPeak
        </div>
      </div>
    </div>
  );
};
