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
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ 
          duration: 0.3,
          ease: [0.34, 1.56, 0.64, 1] // Spring easing
        }}
        className="text-center"
      >
        {/* Pace - Primary display */}
        <div className="text-5xl sm:text-6xl font-bold text-primary leading-none mb-2">
          {calculatePace(value)}
          <span className="text-2xl sm:text-3xl font-semibold text-primary/70 ml-2">
            /km
          </span>
        </div>
        
        {/* Total time - Secondary info */}
        <div className="text-lg sm:text-xl font-medium text-muted-foreground/70 mt-3">
          {formatTime(value)} total
        </div>
      </motion.div>

      {/* Control buttons */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => handleChange(-step)}
          disabled={!canDecrease}
          aria-label="Diminuir pace"
          className={cn(
            "group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full",
            "bg-primary/10 hover:bg-primary/20 active:scale-95",
            "transition-all duration-200 shadow-lg",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10",
            "flex items-center justify-center"
          )}
        >
          <Minus 
            className="w-6 h-6 sm:w-7 sm:h-7 text-primary transition-transform group-hover:scale-110" 
            strokeWidth={2.5}
          />
        </button>

        <div className="w-16 h-1 rounded-full bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />

        <button
          onClick={() => handleChange(step)}
          disabled={!canIncrease}
          aria-label="Aumentar pace"
          className={cn(
            "group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full",
            "bg-primary/10 hover:bg-primary/20 active:scale-95",
            "transition-all duration-200 shadow-lg",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10",
            "flex items-center justify-center"
          )}
        >
          <Plus 
            className="w-6 h-6 sm:w-7 sm:h-7 text-primary transition-transform group-hover:scale-110" 
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
