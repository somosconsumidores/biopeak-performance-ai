import * as React from 'react';
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
  const [localValue, setLocalValue] = React.useState(value);
  const isUserScrollingRef = React.useRef(false);
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const snapTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

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
    if (distance === 1) return 0.7;
    if (distance === 2) return 0.5;
    return 0.3;
  };

  // Calculate scale based on distance from selected item
  const calculateScale = (index: number, selectedIndex: number): number => {
    const distance = Math.abs(index - selectedIndex);
    if (distance === 0) return 1;
    if (distance === 1) return 0.9;
    return 0.85;
  };

  // Initial scroll to value on mount
  React.useEffect(() => {
    if (scrollRef.current && !isUserScrollingRef.current) {
      const index = timeOptions.findIndex(opt => opt === value);
      if (index !== -1) {
        const itemHeight = 60;
        const containerHeight = 300;
        const scrollTop = (index * itemHeight) - (containerHeight / 2) + (itemHeight / 2);
        
        scrollRef.current.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'auto'
        });
      }
    }
  }, [timeOptions]);

  // Snap to nearest item after scroll ends
  const snapToNearestItem = React.useCallback(() => {
    if (!scrollRef.current) return;
    
    const container = scrollRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = 60;
    const containerHeight = 300;
    
    // Calculate which item is closest to center
    const centerOffset = scrollTop + (containerHeight / 2);
    const centerIndex = Math.round(centerOffset / itemHeight);
    const clampedIndex = Math.max(0, Math.min(centerIndex, timeOptions.length - 1));
    const selectedValue = timeOptions[clampedIndex];
    
    // Snap scroll to exact center position
    const targetScrollTop = (clampedIndex * itemHeight) - (containerHeight / 2) + (itemHeight / 2);
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
    
    // Update value with debounce
    if (selectedValue !== undefined && selectedValue !== localValue) {
      setLocalValue(selectedValue);
      
      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Debounced onChange call
      debounceTimeoutRef.current = setTimeout(() => {
        onChange(selectedValue);
        isUserScrollingRef.current = false;
      }, 200);
    }
  }, [timeOptions, localValue, onChange]);

  // Handle scroll events
  const handleScroll = React.useCallback(() => {
    isUserScrollingRef.current = true;
    
    // Clear existing snap timeout
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current);
    }
    
    // Snap after scroll settles
    snapTimeoutRef.current = setTimeout(() => {
      snapToNearestItem();
    }, 150);
  }, [snapToNearestItem]);

  // Handle touch end for mobile precision
  const handleTouchEnd = React.useCallback(() => {
    setTimeout(() => {
      snapToNearestItem();
    }, 50);
  }, [snapToNearestItem]);

  const selectedIndex = timeOptions.findIndex(opt => opt === localValue);

  return (
    <div className={cn('relative', className)}>
      {/* Label */}
      {label && (
        <div className="text-center mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
      )}

      {/* Scrollable picker container */}
      <div className="relative h-[300px] overflow-hidden rounded-xl border border-border/50 bg-background/30 backdrop-blur-md">
        {/* Top fade gradient */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background via-background/90 to-transparent pointer-events-none z-10" />
        
        {/* Selection indicator */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[60px] border-y border-primary/50 bg-primary/10 rounded-lg pointer-events-none z-10" />

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchEnd={handleTouchEnd}
          className="h-[300px] overflow-y-auto py-[120px] scrollbar-hide"
          style={{ 
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {timeOptions.map((time, index) => {
            const isSelected = index === selectedIndex;
            const opacity = calculateOpacity(index, selectedIndex);
            const scale = calculateScale(index, selectedIndex);

            return (
              <div
                key={time}
                className={cn(
                  'h-[60px] flex items-center justify-center transition-all duration-300',
                  'cursor-pointer select-none'
                )}
                style={{
                  opacity,
                  transform: `scale(${scale})`,
                  scrollSnapAlign: 'center'
                }}
                onClick={() => {
                  setLocalValue(time);
                  onChange(time);
                  isUserScrollingRef.current = false;
                }}
              >
                <div className="text-center">
                  <div
                    className={cn(
                      'font-semibold transition-all duration-300',
                      isSelected
                        ? 'text-3xl text-primary'
                        : 'text-lg text-muted-foreground/70'
                    )}
                    style={isSelected ? {
                      textShadow: '0 0 20px hsl(var(--primary) / 0.3)'
                    } : undefined}
                  >
                    {formatTime(time)}{' '}
                    <span className={cn(
                      'text-sm font-medium',
                      isSelected ? 'text-primary/80' : 'text-muted-foreground/50'
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
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-10" />
      </div>

      {/* Range info */}
      <div className="text-center mt-3">
        <p className="text-xs text-muted-foreground/60 font-medium">
          Faixa válida: <span className="font-mono">{formatTime(min)} - {formatTime(max)}</span>
        </p>
      </div>
    </div>
  );
}
