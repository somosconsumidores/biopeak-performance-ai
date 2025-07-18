import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Heart, Timer, AlertCircle } from 'lucide-react';
import { useActivityDetailsChart } from '@/hooks/useActivityDetailsChart';
import { useScreenSize } from '@/hooks/use-mobile';

interface HeartRatePaceChartProps {
  activityId: string | null;
}

export const HeartRatePaceChart = ({ activityId }: HeartRatePaceChartProps) => {
  const { data, loading, error, hasData } = useActivityDetailsChart(activityId);
  const { isMobile, isTablet } = useScreenSize();

  if (loading) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo e Frequência Cardíaca</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !hasData) {
    return (
      <Card className="glass-card border-glass-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 text-primary" />
            <span>Evolução do Ritmo e Frequência Cardíaca</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Dados não disponíveis</h3>
              <p className="text-muted-foreground">
                Esta atividade não possui dados detalhados de frequência cardíaca e ritmo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average values for reference lines (excluding null values for pace)
  const validPaceData = data.filter(item => item.pace_min_per_km !== null && item.pace_min_per_km > 0);
  const avgHeartRate = data.reduce((sum, item) => sum + item.heart_rate, 0) / data.length;
  const avgPace = validPaceData.length > 0 ? validPaceData.reduce((sum, item) => sum + item.pace_min_per_km!, 0) / validPaceData.length : 0;

  // Custom tooltip optimized for mobile
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const minutes = Math.floor(data.pace_min_per_km || 0);
      const seconds = Math.round(((data.pace_min_per_km || 0) - minutes) * 60);
      const paceDisplay = data.pace_min_per_km && data.pace_min_per_km > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}/km` : "Parado";
      
      return (
        <div className={`bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg ${
          isMobile ? 'p-2 max-w-[200px]' : 'p-3'
        }`}>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? `${data.distance_km.toFixed(1)}km` : `Distância: ${data.distance_km.toFixed(2)}km`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? paceDisplay : `Ritmo: ${paceDisplay}`}
          </p>
          <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {isMobile ? `${data.heart_rate} bpm` : `FC: ${data.heart_rate} bpm`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-primary" />
          <span>Evolução do Ritmo e Frequência Cardíaca</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {/* Strava-style chart with gradient background */}
        <div className={`relative overflow-hidden rounded-lg ${isMobile ? 'h-72' : 'h-80 sm:h-96'}`} style={{
          background: isMobile ? 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)/10) 100%)' : undefined
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ 
                top: isMobile ? 20 : 25, 
                right: isMobile ? 20 : 30, 
                left: isMobile ? 45 : 50, 
                bottom: isMobile ? 30 : 40 
              }}
            >
              {/* Simplified grid for cleaner look */}
              <CartesianGrid 
                strokeDasharray="2 4" 
                className="opacity-20" 
                horizontal={true}
                vertical={false}
              />
              
              {/* Bottom axis - Distance */}
              <XAxis 
                dataKey="distance_km" 
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => `${value.toFixed(isMobile ? 0 : 1)}`}
                fontSize={isMobile ? 11 : 13}
                tick={{ fontSize: isMobile ? 11 : 13, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 'preserveStartEnd' : 'preserveStartEnd'}
                tickCount={isMobile ? 4 : 6}
              />
              
              {/* Left axis - Pace */}
              <YAxis 
                yAxisId="pace"
                dataKey="pace_min_per_km"
                domain={['dataMin - 0.3', 'dataMax + 0.3']}
                tickFormatter={(value) => {
                  if (value === null || value === undefined) return '';
                  const minutes = Math.floor(value);
                  const seconds = Math.round((value - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }}
                fontSize={isMobile ? 10 : 12}
                tick={{ fontSize: isMobile ? 10 : 12, fill: 'hsl(var(--primary))' }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 42 : 50}
                tickCount={isMobile ? 4 : 5}
              />
              
              {/* Right axis - Heart Rate */}
              <YAxis 
                yAxisId="hr"
                orientation="right"
                domain={['dataMin - 5', 'dataMax + 5']}
                tickFormatter={(value) => `${Math.round(value)}`}
                fontSize={isMobile ? 10 : 12}
                tick={{ fontSize: isMobile ? 10 : 12, fill: 'hsl(var(--chart-2))' }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 35 : 45}
                tickCount={isMobile ? 4 : 5}
              />
              
              {/* Strava-style tooltip */}
              <Tooltip content={<CustomTooltip />} />
              
              {/* Pace line with Strava-style gradient */}
              <defs>
                <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6}/>
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              {/* Heart Rate area (background layer) */}
              <Line 
                yAxisId="hr"
                type="monotone" 
                dataKey="heart_rate" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={isMobile ? 2.5 : 3}
                dot={false}
                activeDot={{ 
                  r: isMobile ? 4 : 5, 
                  fill: "hsl(var(--chart-2))",
                  stroke: "white",
                  strokeWidth: 2
                }}
                name="FC"
                fillOpacity={0.3}
                fill="url(#hrGradient)"
              />
              
              {/* Pace line (foreground layer) */}
              <Line 
                yAxisId="pace"
                type="monotone" 
                dataKey="pace_min_per_km" 
                stroke="hsl(var(--primary))" 
                strokeWidth={isMobile ? 3 : 3.5}
                dot={false}
                activeDot={{ 
                  r: isMobile ? 5 : 6, 
                  fill: "hsl(var(--primary))",
                  stroke: "white",
                  strokeWidth: 2,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                }}
                name="Ritmo"
                connectNulls={false}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Strava-style floating labels on mobile */}
          {isMobile && (
            <div className="absolute top-3 left-3 flex flex-col space-y-1">
              <div className="flex items-center space-x-2 text-xs bg-card/90 backdrop-blur-sm rounded-full px-2 py-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="font-medium">Ritmo</span>
              </div>
              <div className="flex items-center space-x-2 text-xs bg-card/90 backdrop-blur-sm rounded-full px-2 py-1">
                <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                <span className="font-medium">FC</span>
              </div>
            </div>
          )}
        </div>
        
        <div className={`mt-4 grid gap-2 ${isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 sm:grid-cols-3 text-xs sm:text-sm'}`}>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-primary rounded flex-shrink-0"></div>
            <span className="truncate">Ritmo: {avgPace > 0 ? `${Math.floor(avgPace)}:${Math.round((avgPace - Math.floor(avgPace)) * 60).toString().padStart(2, '0')}/km` : 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <div className="w-3 h-0.5 bg-secondary rounded flex-shrink-0"></div>
            <span className="truncate">FC: {Math.round(avgHeartRate)} bpm</span>
          </div>
          <div className="text-muted-foreground text-center sm:text-left">
            <span className="truncate">Distância: {data.length > 0 ? data[data.length - 1].distance_km.toFixed(1) : 0}km</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};