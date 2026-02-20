import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EfficiencySegment } from '@/hooks/useEfficiencyFingerprint';

interface Props {
  segments: EfficiencySegment[];
}

const labelColors: Record<string, string> = {
  green: 'bg-green-500/80',
  yellow: 'bg-yellow-500/80',
  red: 'bg-red-500/80',
};

export const EfficiencyHeatmapGrid = ({ segments }: Props) => {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Mapa de eficiência por trecho</h4>
      <TooltipProvider delayDuration={100}>
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {segments.map((seg) => (
            <Tooltip key={seg.segment_number}>
              <TooltipTrigger asChild>
                <div
                  className={`${labelColors[seg.label]} rounded-sm cursor-pointer transition-all hover:scale-y-125 hover:brightness-110`}
                  style={{
                    minWidth: '8px',
                    flex: '1 1 0%',
                    height: `${Math.max(20, seg.efficiency_score * 0.6)}px`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs space-y-1">
                <p className="font-semibold">
                  Trecho {seg.segment_number} — {(seg.start_distance_m / 1000).toFixed(1)}-{(seg.end_distance_m / 1000).toFixed(1)} km
                </p>
                <p>Eficiência: {seg.efficiency_score}/100</p>
                <p>Pace: {seg.avg_pace_min_km.toFixed(2)} min/km</p>
                <p>FC: {seg.avg_hr} bpm</p>
                {seg.avg_power && <p>Potência: {seg.avg_power} W</p>}
                {seg.hr_efficiency_delta !== null && (
                  <p>Delta: {seg.hr_efficiency_delta > 0 ? '+' : ''}{seg.hr_efficiency_delta}%</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>0 km</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/80" /> Eficiente</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/80" /> Atenção</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/80" /> Queda</span>
        </div>
        <span>{(segments[segments.length - 1]?.end_distance_m / 1000).toFixed(1)} km</span>
      </div>
    </div>
  );
};
