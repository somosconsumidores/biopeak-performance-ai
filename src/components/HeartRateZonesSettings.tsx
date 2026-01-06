import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Heart, RotateCcw, Info } from 'lucide-react';
import { 
  HRZonesConfig, 
  DEFAULT_HR_ZONES, 
  HR_ZONE_PRESETS,
  ZONE_COLORS 
} from '@/types/heartRateZones';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeartRateZonesSettingsProps {
  maxHeartRate: number | null;
  hrZones: HRZonesConfig | null;
  theoreticalMaxHR: number | null;
  onMaxHeartRateChange: (value: number | null) => void;
  onHrZonesChange: (zones: HRZonesConfig | null) => void;
}

type ZoneKey = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5';

const ZONE_KEYS: ZoneKey[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'];

export const HeartRateZonesSettings = ({
  maxHeartRate,
  hrZones,
  theoreticalMaxHR,
  onMaxHeartRateChange,
  onHrZonesChange,
}: HeartRateZonesSettingsProps) => {
  const [localMaxHR, setLocalMaxHR] = useState<string>(maxHeartRate?.toString() || '');
  const [localZones, setLocalZones] = useState<HRZonesConfig>(hrZones || DEFAULT_HR_ZONES);

  // Sync local state with props
  useEffect(() => {
    setLocalMaxHR(maxHeartRate?.toString() || '');
  }, [maxHeartRate]);

  useEffect(() => {
    setLocalZones(hrZones || DEFAULT_HR_ZONES);
  }, [hrZones]);

  const effectiveMaxHR = useMemo(() => {
    const parsed = parseInt(localMaxHR);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return theoreticalMaxHR || 190;
  }, [localMaxHR, theoreticalMaxHR]);

  const handleMaxHRChange = (value: string) => {
    setLocalMaxHR(value);
    const parsed = parseInt(value);
    onMaxHeartRateChange(!isNaN(parsed) && parsed > 0 ? parsed : null);
  };

  const handleZoneChange = (
    zoneKey: ZoneKey,
    field: 'minPercent' | 'maxPercent' | 'label',
    value: string | number
  ) => {
    const updatedZones = {
      ...localZones,
      [zoneKey]: {
        ...localZones[zoneKey],
        [field]: field === 'label' ? value : parseInt(value as string) || 0,
      },
    };
    setLocalZones(updatedZones);
    onHrZonesChange(updatedZones);
  };

  const applyPreset = (presetKey: keyof typeof HR_ZONE_PRESETS) => {
    const preset = HR_ZONE_PRESETS[presetKey];
    setLocalZones(preset.zones);
    onHrZonesChange(preset.zones);
  };

  const resetToDefault = () => {
    setLocalMaxHR('');
    setLocalZones(DEFAULT_HR_ZONES);
    onMaxHeartRateChange(null);
    onHrZonesChange(null);
  };

  const calculateBPM = (percent: number) => {
    return Math.round((percent / 100) * effectiveMaxHR);
  };

  return (
    <Card className="glass-card border-glass-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Zonas de Frequência Cardíaca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* FCmax Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="max_heart_rate">FC Máxima (bpm)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Sua frequência cardíaca máxima real. Se você não souber, deixe em branco para usar o valor calculado (220 - idade).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-3">
            <Input
              id="max_heart_rate"
              type="number"
              min={100}
              max={250}
              placeholder={theoreticalMaxHR?.toString() || '190'}
              value={localMaxHR}
              onChange={(e) => handleMaxHRChange(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">
              {theoreticalMaxHR 
                ? `Calculado: ${theoreticalMaxHR} bpm (220 - idade)`
                : 'Informe sua data de nascimento para calcular'}
            </span>
          </div>
        </div>

        {/* Zone Configuration */}
        <div className="space-y-4">
          <Label>Configuração das Zonas</Label>
          
          <div className="space-y-2">
            {ZONE_KEYS.map((zoneKey, index) => {
              const zone = localZones[zoneKey];
              const colorClass = ZONE_COLORS[zoneKey];
              const minBPM = calculateBPM(zone.minPercent);
              const maxBPM = calculateBPM(zone.maxPercent);
              
              return (
                <div key={zoneKey} className="p-3 rounded-lg bg-muted/30 space-y-2">
                  {/* Zone header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colorClass} shrink-0`} />
                      <span className="text-sm font-medium">Zona {index + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {minBPM}-{maxBPM} bpm
                    </span>
                  </div>
                  
                  {/* Zone config row */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={zone.label}
                      onChange={(e) => handleZoneChange(zoneKey, 'label', e.target.value)}
                      className="flex-1 min-w-0 h-9 text-sm"
                      placeholder="Nome"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={zone.minPercent}
                        onChange={(e) => handleZoneChange(zoneKey, 'minPercent', e.target.value)}
                        className="w-14 text-center h-9 text-sm px-1"
                      />
                      <span className="text-muted-foreground text-sm">-</span>
                      <Input
                        type="number"
                        min={0}
                        max={150}
                        value={zone.maxPercent}
                        onChange={(e) => handleZoneChange(zoneKey, 'maxPercent', e.target.value)}
                        className="w-14 text-center h-9 text-sm px-1"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('default')}
          >
            Padrão
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('competitive')}
          >
            Competitivo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('beginner')}
          >
            Iniciante
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="ml-auto"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Resetar
          </Button>
        </div>

        {/* Visual Preview */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Visualização das Zonas</Label>
          <div className="flex h-6 rounded-lg overflow-hidden">
            {ZONE_KEYS.map((zoneKey) => {
              const zone = localZones[zoneKey];
              const width = zone.maxPercent - zone.minPercent;
              const colorClass = ZONE_COLORS[zoneKey];
              
              return (
                <div
                  key={zoneKey}
                  className={`${colorClass} flex items-center justify-center text-xs text-white font-medium`}
                  style={{ width: `${width}%` }}
                  title={`${zone.label}: ${zone.minPercent}-${zone.maxPercent}%`}
                >
                  {width > 10 && `${zone.minPercent}-${zone.maxPercent}%`}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
