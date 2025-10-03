import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RaceDistance, ObjectiveType } from "@/hooks/useRacePlanning";

interface RaceInputsProps {
  distance: RaceDistance;
  onDistanceChange: (value: RaceDistance) => void;
  customDistance: number;
  onCustomDistanceChange: (value: number) => void;
  objectiveType: ObjectiveType;
  onObjectiveTypeChange: (value: ObjectiveType) => void;
  targetTime: string;
  onTargetTimeChange: (value: string) => void;
  targetPace: string;
  onTargetPaceChange: (value: string) => void;
}

export function RaceInputs({
  distance,
  onDistanceChange,
  customDistance,
  onCustomDistanceChange,
  objectiveType,
  onObjectiveTypeChange,
  targetTime,
  onTargetTimeChange,
  targetPace,
  onTargetPaceChange,
}: RaceInputsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="distance">Distância da Prova</Label>
        <Select value={distance} onValueChange={(value) => onDistanceChange(value as RaceDistance)}>
          <SelectTrigger id="distance">
            <SelectValue placeholder="Selecione a distância" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5k">5 km</SelectItem>
            <SelectItem value="10k">10 km</SelectItem>
            <SelectItem value="21k">21 km (Meia Maratona)</SelectItem>
            <SelectItem value="42k">42 km (Maratona)</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        
        {distance === 'custom' && (
          <div className="mt-2">
            <Input
              type="number"
              value={customDistance}
              onChange={(e) => onCustomDistanceChange(Number(e.target.value))}
              min={1}
              max={100}
              step={0.1}
              placeholder="Distância em km"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label>Tipo de Objetivo</Label>
        <RadioGroup value={objectiveType} onValueChange={(value) => onObjectiveTypeChange(value as ObjectiveType)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="time" id="time" />
            <Label htmlFor="time" className="font-normal cursor-pointer">Tempo Total</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pace" id="pace" />
            <Label htmlFor="pace" className="font-normal cursor-pointer">Pace Médio</Label>
          </div>
        </RadioGroup>
      </div>

      {objectiveType === 'time' ? (
        <div className="space-y-2">
          <Label htmlFor="target-time">Tempo Alvo (HH:MM:SS)</Label>
          <Input
            id="target-time"
            type="text"
            value={targetTime}
            onChange={(e) => onTargetTimeChange(e.target.value)}
            placeholder="01:00:00"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Formato: horas:minutos:segundos</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="target-pace">Pace Alvo (MM:SS/km)</Label>
          <Input
            id="target-pace"
            type="text"
            value={targetPace}
            onChange={(e) => onTargetPaceChange(e.target.value)}
            placeholder="06:00"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">Formato: minutos:segundos por km</p>
        </div>
      )}
    </div>
  );
}
