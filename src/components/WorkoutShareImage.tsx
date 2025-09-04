
import { SharePaceHeatmap } from './SharePaceHeatmap';
import { Clock, Route, Activity, Heart } from 'lucide-react';
import { useActivityPaceData } from '@/hooks/useActivityPaceData';
import { useWorkoutClassification } from '@/hooks/useWorkoutClassification';

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
  const { classification } = useWorkoutClassification(activityId);
  
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

  const formatWorkoutType = (type: string | null) => {
    if (!type) return workoutData.activity_type || 'Atividade';
    
    const typeMap: { [key: string]: string } = {
      'long_run': 'Long Run',
      'tempo_run': 'Tempo Run', 
      'interval_training': 'Interval',
      'easy_run': 'Easy Run',
      'recovery_run': 'Recovery',
      'fartlek': 'Fartlek',
      'hill_training': 'Hill Training',
      'race': 'Race',
      'running': 'Run',
      'cycling': 'Bike',
      'swimming': 'Swim'
    };
    
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div 
      className="w-[1080px] h-[1920px] relative overflow-hidden"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundImage: 'url(/lovable-uploads/7bfb3157-f3f5-4190-bd97-ecd792dd786f.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Map container com overlays de Pace e FC */}
      <div 
        className="absolute overflow-hidden rounded-3xl"
        style={{ 
          top: '350px',
          left: '90px', 
          width: '900px',
          height: '600px',
          background: 'rgba(255,255,255,0.95)',
        }}
      >
        {/* Map */}
        {workoutData.coordinates && workoutData.coordinates.length > 0 && workoutData.id && paceData && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SharePaceHeatmap 
              data={paceData}
            />
          </div>
        )}
        {(!workoutData.coordinates || workoutData.coordinates.length === 0 || !workoutData.id || !paceData) && (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-6xl">
            Mapa não disponível
          </div>
        )}
      </div>

      {/* Stats em grid 2x2 */}
      <div className="absolute" style={{ top: '1020px', left: '90px', width: '900px' }}>
        <div className="grid grid-cols-2 gap-12 text-white">
          {/* Tempo */}
          <div className="text-center">
            <div 
              className="font-black text-7xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatDuration(workoutData.duration_in_seconds)}
            </div>
            <div className="font-semibold text-4xl opacity-90">
              Tempo
            </div>
          </div>

          {/* Distância */}
          <div className="text-center">
            <div 
              className="font-black text-7xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatDistance(workoutData.distance_in_meters)}
            </div>
            <div className="font-semibold text-4xl opacity-90">
              Distância
            </div>
          </div>

          {/* Ritmo Médio */}
          <div className="text-center">
            <div 
              className="font-black text-7xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
            </div>
            <div className="font-semibold text-4xl opacity-90">
              Ritmo Médio
            </div>
          </div>

          {/* Calorias */}
          <div className="text-center">
            <div 
              className="font-black text-7xl mb-2"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {workoutData.active_kilocalories ? Math.round(workoutData.active_kilocalories) : '--'}
            </div>
            <div className="font-semibold text-4xl opacity-90">
              Calorias
            </div>
          </div>
        </div>
      </div>

      {/* Classificação da atividade */}
      <div className="absolute bottom-280 left-0 right-0 text-center">
        <div 
          className="text-white font-black text-9xl"
          style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}
        >
          {formatWorkoutType(workoutData.activity_type)}
        </div>
      </div>
    </div>
  );
};
