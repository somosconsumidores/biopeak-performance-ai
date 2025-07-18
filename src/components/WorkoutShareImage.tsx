
import newSocialShareBg from '@/assets/social-share-bg.png';

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
        backgroundImage: `url(/lovable-uploads/2bfefeef-66b1-477e-a779-6d1e44775f6c.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Heart Rate - Central position over the ECG graph */}
      <div className="absolute" style={{ 
        top: '48%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
      }}>
        <div className="text-white font-bold text-8xl mb-2">
          {workoutData.average_heart_rate_in_beats_per_minute || '--'}
        </div>
        <div className="text-white/90 font-semibold text-3xl">
          bpm
        </div>
      </div>

      {/* Top Left - Distance */}
      <div className="absolute" style={{ 
        top: '65%', 
        left: '15%',
        textAlign: 'center'
      }}>
        <div className="text-white font-bold text-5xl mb-1">
          {formatDistance(workoutData.distance_in_meters)}
        </div>
        <div className="text-white/80 font-medium text-xl">
          Distância
        </div>
      </div>

      {/* Top Right - Average Pace */}
      <div className="absolute" style={{ 
        top: '65%', 
        right: '15%',
        textAlign: 'center'
      }}>
        <div className="text-white font-bold text-5xl mb-1">
          {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
        </div>
        <div className="text-white/80 font-medium text-xl">
          Ritmo Médio
        </div>
      </div>

      {/* Bottom Left - Calories */}
      <div className="absolute" style={{ 
        bottom: '20%', 
        left: '15%',
        textAlign: 'center'
      }}>
        <div className="text-white font-bold text-5xl mb-1">
          {workoutData.active_kilocalories || '--'}
        </div>
        <div className="text-white/80 font-medium text-xl">
          Calorias
        </div>
      </div>

      {/* Bottom Right - Total Time */}
      <div className="absolute" style={{ 
        bottom: '20%', 
        right: '15%',
        textAlign: 'center'
      }}>
        <div className="text-white font-bold text-5xl mb-1">
          {formatDuration(workoutData.duration_in_seconds)}
        </div>
        <div className="text-white/80 font-medium text-xl">
          Tempo Total
        </div>
      </div>
    </div>
  );
};
