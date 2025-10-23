import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSpinnerProps {
  value: number; // Total minutes
  onChange: (minutes: number) => void;
  min: number; // Minimum time in minutes
  max: number; // Maximum time in minutes
  step?: number; // Increment in minutes (default: 1)
  format?: 'MM:SS' | 'H:MM'; // Display format
  distance?: string; // For context/label
  className?: string;
}

export function TimeSpinner({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = 'MM:SS',
  distance,
  className,
}: TimeSpinnerProps) {
  
  const increment = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const decrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const formatTime = (totalMinutes: number): string => {
    if (format === 'MM:SS') {
      const minutes = Math.floor(totalMinutes);
      const seconds = Math.round((totalMinutes - minutes) * 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // H:MM format
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
  };

  const formatRange = (): string => {
    return `${formatTime(min)} - ${formatTime(max)}`;
  };

  const isAtMin = value <= min;
  const isAtMax = value >= max;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-center gap-2">
        {/* Decrement Button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={decrement}
          disabled={isAtMin}
          className={cn(
            'h-12 w-12 rounded-lg transition-all',
            isAtMin && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>

        {/* Time Display */}
        <div className="flex-1 max-w-[200px]">
          <div className="relative">
            <div className="text-center p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border-2 border-primary/20 shadow-sm">
              <div className="text-3xl font-bold font-mono text-foreground tracking-wider">
                {formatTime(value)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format === 'MM:SS' ? 'minutos:segundos' : 'horas:minutos'}
              </div>
            </div>
          </div>
        </div>

        {/* Increment Button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={increment}
          disabled={isAtMax}
          className={cn(
            'h-12 w-12 rounded-lg transition-all',
            isAtMax && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Range Info */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Faixa válida: <span className="font-mono font-medium">{formatRange()}</span>
        </p>
        {distance && (
          <p className="text-xs text-muted-foreground mt-1">
            para {distance}
          </p>
        )}
      </div>
    </div>
  );
}
