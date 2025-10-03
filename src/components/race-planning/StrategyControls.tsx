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
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-3">
        <Label className="text-sm sm:text-base">Estratégia de Corrida</Label>
        <RadioGroup value={strategy} onValueChange={(value) => onStrategyChange(value as StrategyType)}>
          <div className="flex items-center space-x-3 p-3.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors active:bg-accent/70 min-h-[60px] sm:min-h-0">
            <RadioGroupItem value="constant" id="constant" className="h-5 w-5 flex-shrink-0" />
            <Label htmlFor="constant" className="font-normal cursor-pointer flex items-center gap-2 sm:gap-2 flex-1">
              <Minus className="h-5 w-5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium text-sm sm:text-base">Pace Constante</div>
                <div className="text-xs text-muted-foreground">Mesmo ritmo do início ao fim</div>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-3 p-3.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors active:bg-accent/70 min-h-[60px] sm:min-h-0">
            <RadioGroupItem value="negative" id="negative" className="h-5 w-5 flex-shrink-0" />
            <Label htmlFor="negative" className="font-normal cursor-pointer flex items-center gap-2 sm:gap-2 flex-1">
              <TrendingUp className="h-5 w-5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm sm:text-base">Negative Split</div>
                <div className="text-xs text-muted-foreground">Começa lento, termina rápido</div>
              </div>
            </Label>
          </div>
          
          <div className="flex items-center space-x-3 p-3.5 sm:p-3 border rounded-lg hover:bg-accent/50 transition-colors active:bg-accent/70 min-h-[60px] sm:min-h-0">
            <RadioGroupItem value="positive" id="positive" className="h-5 w-5 flex-shrink-0" />
            <Label htmlFor="positive" className="font-normal cursor-pointer flex items-center gap-2 sm:gap-2 flex-1">
              <TrendingDown className="h-5 w-5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm sm:text-base">Positive Split</div>
                <div className="text-xs text-muted-foreground">Começa rápido, termina lento</div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {strategy !== 'constant' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-sm sm:text-base">Intensidade da Variação</Label>
            <span className="text-sm font-mono text-muted-foreground">{intensity}%</span>
          </div>
          <Slider
            value={[intensity]}
            onValueChange={(value) => onIntensityChange(value[0])}
            min={5}
            max={20}
            step={1}
            className="w-full py-2"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste a diferença de pace entre início e fim da prova
          </p>
        </div>
      )}
    </div>
  );
}
