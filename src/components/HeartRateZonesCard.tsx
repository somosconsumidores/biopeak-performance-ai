import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart } from 'lucide-react';

interface HeartRateZone {
  zone: string;
  label: string;
  minHR: number;
  maxHR: number;
  percentage: number;
  timeInZone: number;
  color: string;
}

interface HeartRateZonesCardProps {
  zones: HeartRateZone[];
  loading: boolean;
}

export function HeartRateZonesCard({ zones, loading }: HeartRateZonesCardProps) {
  return (
    <Card className="glass-card border-glass-border mb-6 sm:mb-8">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
          <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
          <span>Distribuição por Zona de FC</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-xs sm:text-sm text-muted-foreground">Calculando zonas...</p>
          </div>
        ) : zones.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {zones.map((zone, index) => (
              <div key={index} className="space-y-1.5 sm:space-y-2">
                {/* Mobile: Stack vertically, Desktop: Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  {/* Zone info */}
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${zone.color}`} />
                    <span className="text-xs sm:text-sm font-medium">{zone.zone}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">({zone.label})</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:inline">{zone.minHR}-{zone.maxHR} bpm</span>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center space-x-2 sm:space-x-3 ml-4 sm:ml-0">
                    <span className="text-xs sm:text-sm font-semibold text-primary">{zone.percentage}%</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {Math.floor(zone.timeInZone / 60)}:{(zone.timeInZone % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-muted-foreground xs:hidden">{zone.minHR}-{zone.maxHR}</span>
                  </div>
                </div>
                <Progress value={zone.percentage} className="h-2 sm:h-2.5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 sm:py-6">
            <Heart className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs sm:text-sm text-muted-foreground">Dados de zona não disponíveis para esta atividade</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
