
import { Zap, Gauge, Heart, TrendingUp } from 'lucide-react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';

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
  const { metrics, loading } = usePerformanceMetrics(activityId);
  
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

  const formatWorkoutType = () => {
    // Priorizar activity_type da tabela all_activities
    const type = workoutData.activity_type;
    if (!type) return 'Atividade';
    
    const typeMap: { [key: string]: string } = {
      'long_run': 'Long Run',
      'tempo_run': 'Tempo Run', 
      'interval_training': 'Interval',
      'easy_run': 'Easy Run',
      'recovery_run': 'Recovery',
      'fartlek': 'Fartlek',
      'hill_training': 'Hill Training',
      'race': 'Race',
      'running': 'Corrida',
      'cycling': 'Ciclismo',
      'swimming': 'Natação'
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
      {/* Performance Cards Container */}
      <div 
        className="absolute"
        style={{ 
          top: '350px',
          left: '90px', 
          width: '900px',
          height: '600px'
        }}
      >
        {metrics && !loading ? (
          <div className="grid grid-cols-2 gap-8 h-full">
            {/* Eficiência */}
            <div 
              className="rounded-3xl p-8 flex flex-col justify-between"
              style={{ 
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(249, 115, 22, 0.2))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: 'rgba(251, 191, 36, 0.3)' }}
                >
                  <Zap className="h-12 w-12 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">
                    {metrics.efficiency.distancePerMinute != null 
                      ? `${metrics.efficiency.distancePerMinute.toFixed(2)}`
                      : '--'}
                  </div>
                  <div className="text-2xl font-medium text-white/80">km/min</div>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">Eficiência</h3>
                <p className="text-xl text-white/80 line-clamp-3">{metrics.efficiency.comment}</p>
              </div>
            </div>

            {/* Ritmo & Velocidade */}
            <div 
              className="rounded-3xl p-8 flex flex-col justify-between"
              style={{ 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}
                >
                  <Gauge className="h-12 w-12 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">
                    {metrics.pace.averageSpeedKmh != null
                      ? `${metrics.pace.averageSpeedKmh.toFixed(1)}`
                      : '--'}
                  </div>
                  <div className="text-2xl font-medium text-white/80">km/h</div>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">Ritmo & Velocidade</h3>
                <p className="text-xl text-white/80 line-clamp-3">{metrics.pace.comment}</p>
              </div>
            </div>

            {/* Frequência Cardíaca */}
            <div 
              className="rounded-3xl p-8 flex flex-col justify-between"
              style={{ 
                background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(236, 72, 153, 0.2))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: 'rgba(248, 113, 113, 0.3)' }}
                >
                  <Heart className="h-12 w-12 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">
                    {metrics.heartRate.averageHr != null
                      ? `${Math.round(metrics.heartRate.averageHr)}`
                      : '--'}
                  </div>
                  <div className="text-2xl font-medium text-white/80">bpm</div>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">Frequência Cardíaca</h3>
                <p className="text-xl text-white/80 line-clamp-3">{metrics.heartRate.comment}</p>
              </div>
            </div>

            {/* Distribuição do Esforço */}
            <div 
              className="rounded-3xl p-8 flex flex-col justify-between"
              style={{ 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(168, 85, 247, 0.2))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.3)' }}
                >
                  <TrendingUp className="h-12 w-12 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">
                    {metrics.effortDistribution.middle != null
                      ? `${Math.round(metrics.effortDistribution.middle)}`
                      : '--'}
                  </div>
                  <div className="text-2xl font-medium text-white/80">médio</div>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">Distribuição do Esforço</h3>
                <p className="text-xl text-white/80 line-clamp-3">{metrics.effortDistribution.comment}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div 
              className="text-white font-bold text-4xl text-center"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
            >
              {loading ? 'Carregando métricas...' : 'Métricas não disponíveis'}
            </div>
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
          className="text-white font-black text-6xl"
          style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}
        >
          {formatWorkoutType()}
        </div>
      </div>
    </div>
  );
};
