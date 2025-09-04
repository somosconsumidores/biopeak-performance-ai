
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
        backgroundImage: 'url(/lovable-uploads/97a6bd45-68b7-4454-a48a-f2a63b0f6b58.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Logo no topo central */}
      <div className="absolute top-20 left-0 right-0 text-center">
        <img 
          src="/lovable-uploads/b1bd9b87-afb9-479a-ab3c-563049af276a.png" 
          alt="BioPeak Logo" 
          className="w-80 h-80 mx-auto object-contain filter drop-shadow-2xl"
        />
      </div>

      {/* Map container - centralizado abaixo da logo */}
      <div 
        className="absolute overflow-hidden rounded-2xl"
        style={{ 
          top: '450px',
          left: '90px', 
          width: '900px',
          height: '600px',
          background: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {workoutData.coordinates && workoutData.coordinates.length > 0 && workoutData.id && paceData && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SharePaceHeatmap 
              data={paceData}
            />
          </div>
        )}
        {(!workoutData.coordinates || workoutData.coordinates.length === 0 || !workoutData.id || !paceData) && (
          <div className="w-full h-full flex items-center justify-center text-white text-6xl">
            Mapa não disponível
          </div>
        )}
      </div>

      {/* Stats em texto branco - posicionadas na parte inferior */}
      <div className="absolute bottom-200 left-0 right-0 px-20">
        <div className="grid grid-cols-2 gap-8 text-white">
          {/* Tempo */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Clock className="w-16 h-16 text-white" />
            </div>
            <div 
              className="font-black text-8xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatDuration(workoutData.duration_in_seconds)}
            </div>
            <div className="font-semibold text-5xl opacity-90">
              Tempo
            </div>
          </div>

          {/* Distância */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Route className="w-16 h-16 text-white" />
            </div>
            <div 
              className="font-black text-8xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatDistance(workoutData.distance_in_meters)}
            </div>
            <div className="font-semibold text-5xl opacity-90">
              Distância
            </div>
          </div>

          {/* Pace Médio */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Activity className="w-16 h-16 text-white" />
            </div>
            <div 
              className="font-black text-8xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
            </div>
            <div className="font-semibold text-5xl opacity-90">
              Pace Médio
            </div>
          </div>

          {/* FC Média */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Heart className="w-16 h-16 text-white" />
            </div>
            <div 
              className="font-black text-8xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatHeartRate(workoutData.average_heart_rate_in_beats_per_minute)}
            </div>
            <div className="font-semibold text-5xl opacity-90">
              FC Média
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <div className="text-white font-semibold text-5xl opacity-90">
          📱 Acompanhe seus treinos no BioPeak
        </div>
      </div>
    </div>
  );
};
