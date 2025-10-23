import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ScrollableTimePickerProps {
  value: number; // Total minutes
  onChange: (minutes: number) => void;
  min: number; // Minimum time in minutes
  max: number; // Maximum time in minutes
  step: number; // Increment in minutes (e.g., 0.5, 1, 5)
  distance: number; // Distance in km for pace calculation
  format: 'MM:SS' | 'H:MM'; // Display format
  label?: string; // e.g., "10 km"
  className?: string;
}

export function ScrollableTimePicker({
  value,
  onChange,
  min,
  max,
  step,
  distance,
  format,
  label,
  className,
}: ScrollableTimePickerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = React.useState(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  // Generate array of time options
  const timeOptions = React.useMemo(() => {
    const options: number[] = [];
    for (let t = min; t <= max; t += step) {
      options.push(t);
    }
    return options;
  }, [min, max, step]);

  // Format time for display
  const formatTime = (totalMinutes: number): string => {
    if (format === 'MM:SS') {
      const mins = Math.floor(totalMinutes);
      const secs = Math.round((totalMinutes - mins) * 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      // H:MM format
      const hrs = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      return `${hrs}:${mins.toString().padStart(2, '0')}:00`;
    }
  };

  // Calculate pace in min/km
  const calculatePace = (totalMinutes: number): string => {
    const totalSeconds = totalMinutes * 60;
    const paceSeconds = totalSeconds / distance;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.floor(paceSeconds % 60);
    return `${m.toString().padStart(2, '0')}'${s.toString().padStart(2, '0')}"`;
  };

  // Calculate opacity based on distance from selected item
  const calculateOpacity = (index: number, selectedIndex: number): number => {
    const distance = Math.abs(index - selectedIndex);
    if (distance === 0) return 1;
    if (distance === 1) return 0.6;
    if (distance === 2) return 0.4;
    return 0.2;
  };

  // Calculate scale based on distance from selected item
  const calculateScale = (index: number, selectedIndex: number): number => {
    const distance = Math.abs(index - selectedIndex);
    if (distance === 0) return 1.1;
    if (distance === 1) return 0.95;
    return 0.9;
  };

  // Scroll to selected value on mount and when value changes externally
  React.useEffect(() => {
    if (scrollRef.current && !isScrolling) {
      const index = timeOptions.findIndex(opt => opt === value);
      if (index !== -1) {
        const itemHeight = 60;
        const containerHeight = 300;
        const scrollTop = (index * itemHeight) - (containerHeight / 2) + (itemHeight / 2);
        
        scrollRef.current.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, [value, timeOptions, isScrolling]);

  // Handle scroll events
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = 60;
    const containerHeight = 300;
    
    // Calculate which item is in the center
    const centerOffset = scrollTop + (containerHeight / 2);
    const centerIndex = Math.round(centerOffset / itemHeight);
    const selectedValue = timeOptions[centerIndex];
    
    if (selectedValue !== undefined && selectedValue !== value) {
      setIsScrolling(true);
      onChange(selectedValue);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set new timeout to stop scrolling state
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    }
  }, [timeOptions, value, onChange]);

  const selectedIndex = timeOptions.findIndex(opt => opt === value);

  return (
    <div className={cn('relative', className)}>
      {/* Label */}
      {label && (
        <div className="text-center mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
      )}

      {/* Scrollable picker container */}
      <div className="relative h-[300px] overflow-hidden rounded-lg border border-border bg-background/50">
        {/* Top fade gradient */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none z-10" />
        
        {/* Selection indicator */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[60px] border-y-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[300px] overflow-y-auto py-[120px] scroll-smooth"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {timeOptions.map((time, index) => {
            const isSelected = index === selectedIndex;
            const opacity = calculateOpacity(index, selectedIndex);
            const scale = calculateScale(index, selectedIndex);

            return (
              <div
                key={time}
                className={cn(
                  'h-[60px] flex items-center justify-center transition-all duration-200',
                  'cursor-pointer select-none',
                  isSelected && 'font-bold'
                )}
                style={{
                  opacity,
                  transform: `scale(${scale})`,
                  scrollSnapAlign: 'center'
                }}
                onClick={() => {
                  onChange(time);
                }}
              >
                <div className="text-center">
                  <div
                    className={cn(
                      'font-mono transition-all duration-200',
                      isSelected
                        ? 'text-2xl font-bold text-primary'
                        : 'text-lg text-muted-foreground'
                    )}
                  >
                    {formatTime(time)}{' '}
                    <span className={cn(
                      'text-sm',
                      isSelected ? 'text-primary/80' : 'text-muted-foreground/60'
                    )}>
                      ({calculatePace(time)}/km)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom fade gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />
      </div>

      {/* Range info */}
      <div className="text-center mt-2">
        <p className="text-xs text-muted-foreground">
          Faixa válida: <span className="font-mono font-medium">{formatTime(min)} - {formatTime(max)}</span>
        </p>
      </div>
    </div>
  );
}
