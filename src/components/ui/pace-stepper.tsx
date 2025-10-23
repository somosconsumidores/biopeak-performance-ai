import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaceStepperProps {
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

export function PaceStepper({
  value,
  onChange,
  min,
  max,
  step,
  distance,
  format,
  label,
  className,
}: PaceStepperProps) {
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
    return `${m}'${s.toString().padStart(2, '0')}"`;
  };

  const handleChange = (delta: number) => {
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className={cn('flex flex-col items-center gap-6 p-4 sm:p-6', className)}>
      {/* Label */}
      {label && (
        <div className="text-center">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
      )}

      {/* Main value display with animation */}
      <motion.div
        key={value}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ 
          duration: 0.2,
          ease: [0.34, 1.56, 0.64, 1]
        }}
        className="text-center"
      >
        {/* Pace - Primary display */}
        <div className="flex items-end justify-center gap-1 text-2xl sm:text-3xl font-semibold text-primary leading-none">
          <span>{calculatePace(value)}</span>
          <span className="text-base text-primary/80 font-medium">/km</span>
        </div>
        
        {/* Total time - Secondary info */}
        <div className="text-sm text-muted-foreground mt-1">
          {formatTime(value)} total
        </div>
      </motion.div>

      {/* Control buttons */}
      <div className="flex items-center gap-6 mt-3 sm:mt-4">
        <button
          onClick={() => handleChange(-step)}
          disabled={!canDecrease}
          aria-label="Diminuir pace"
          className={cn(
            "group relative w-10 h-10 sm:w-12 sm:h-12 rounded-full",
            "bg-primary/10 hover:bg-primary/20 active:scale-95",
            "transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10",
            "flex items-center justify-center"
          )}
        >
          <Minus 
            className="w-5 h-5 text-primary transition-transform group-hover:scale-110" 
            strokeWidth={2.5}
          />
        </button>

        <div className="w-12 h-0.5 rounded-full bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />

        <button
          onClick={() => handleChange(step)}
          disabled={!canIncrease}
          aria-label="Aumentar pace"
          className={cn(
            "group relative w-10 h-10 sm:w-12 sm:h-12 rounded-full",
            "bg-primary/10 hover:bg-primary/20 active:scale-95",
            "transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10",
            "flex items-center justify-center"
          )}
        >
          <Plus 
            className="w-5 h-5 text-primary transition-transform group-hover:scale-110" 
            strokeWidth={2.5}
          />
        </button>
      </div>

      {/* Range info */}
      <div className="text-center mt-2">
        <p className="text-xs text-muted-foreground/60 font-medium">
          Faixa: <span className="font-mono">{formatTime(min)} - {formatTime(max)}</span>
        </p>
      </div>
    </div>
  );
}
