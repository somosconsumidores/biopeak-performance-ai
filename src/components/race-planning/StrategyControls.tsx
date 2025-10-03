import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StrategyType } from "@/hooks/useRacePlanning";
import { TrendingUp, Minus, TrendingDown } from "lucide-react";

interface StrategyControlsProps {
  strategy: StrategyType;
  onStrategyChange: (value: StrategyType) => void;
  intensity: number;
  onIntensityChange: (value: number) => void;
}

export function StrategyControls({
  strategy,
  onStrategyChange,
  intensity,
  onIntensityChange,
}: StrategyControlsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Estratégia de Corrida</Label>
        <RadioGroup value={strategy} onValueChange={(value) => onStrategyChange(value as StrategyType)}>
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="constant" id="constant" />
            <Label htmlFor="constant" className="font-normal cursor-pointer flex items-center gap-2 flex-1">
              <Minus className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Pace Constante</div>
                <div className="text-xs text-muted-foreground">Mesmo ritmo do início ao fim</div>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="negative" id="negative" />
            <Label htmlFor="negative" className="font-normal cursor-pointer flex items-center gap-2 flex-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-medium">Negative Split</div>
                <div className="text-xs text-muted-foreground">Começa lento, termina rápido</div>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="positive" id="positive" />
            <Label htmlFor="positive" className="font-normal cursor-pointer flex items-center gap-2 flex-1">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">Positive Split</div>
                <div className="text-xs text-muted-foreground">Começa rápido, termina lento</div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {strategy !== 'constant' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Intensidade da Variação</Label>
            <span className="text-sm font-mono text-muted-foreground">{intensity}%</span>
          </div>
          <Slider
            value={[intensity]}
            onValueChange={(value) => onIntensityChange(value[0])}
            min={5}
            max={20}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste a diferença de pace entre início e fim da prova
          </p>
        </div>
      )}
    </div>
  );
}
