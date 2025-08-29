import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Brain, Target, Zap, Gauge, Clock, Heart } from 'lucide-react';
import type { WorkoutClassification } from '@/hooks/useWorkoutClassification';

interface WorkoutClassificationBadgeProps {
  classification: WorkoutClassification;
  variant?: 'default' | 'detailed';
}

export const WorkoutClassificationBadge: React.FC<WorkoutClassificationBadgeProps> = ({ 
  classification, 
  variant = 'default' 
}) => {
  const getWorkoutTypeIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    
    if (normalizedType.includes('interval') || normalizedType.includes('speed')) {
      return <Zap className="h-3 w-3" />;
    }
    if (normalizedType.includes('threshold') || normalizedType.includes('tempo')) {
      return <Target className="h-3 w-3" />;
    }
    if (normalizedType.includes('recovery') || normalizedType.includes('easy')) {
      return <Heart className="h-3 w-3" />;
    }
    if (normalizedType.includes('long') || normalizedType.includes('endurance')) {
      return <Clock className="h-3 w-3" />;
    }
    if (normalizedType.includes('fartlek') || normalizedType.includes('progression')) {
      return <Gauge className="h-3 w-3" />;
    }
    
    return <Brain className="h-3 w-3" />;
  };

  const getWorkoutTypeColor = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    const normalizedType = type.toLowerCase();
    
    if (normalizedType.includes('interval') || normalizedType.includes('speed')) {
      return 'destructive'; // Red for high intensity
    }
    if (normalizedType.includes('threshold') || normalizedType.includes('tempo')) {
      return 'default'; // Primary color for moderate-high intensity
    }
    if (normalizedType.includes('recovery') || normalizedType.includes('easy')) {
      return 'secondary'; // Green/secondary for recovery
    }
    if (normalizedType.includes('long') || normalizedType.includes('endurance')) {
      return 'outline'; // Outline for endurance
    }
    
    return 'default';
  };

  const formatWorkoutType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'interval_training': 'Intervalado',
      'tempo_run': 'Tempo Run',
      'threshold_run': 'Limiar',
      'easy_run': 'Regenerativo',
      'recovery_run': 'Recuperação',
      'long_run': 'Longo',
      'speed_work': 'Velocidade',
      'fartlek': 'Fartlek',
      'progression_run': 'Progressão',
      'endurance_run': 'Endurance',
      'base_run': 'Base',
      'workout': 'Treino'
    };

    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  if (variant === 'detailed') {
    return (
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Classificação AI</span>
        </div>
        <Badge 
          variant={getWorkoutTypeColor(classification.detected_workout_type)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium w-fit"
        >
          {getWorkoutTypeIcon(classification.detected_workout_type)}
          <span>{formatWorkoutType(classification.detected_workout_type)}</span>
        </Badge>
        {classification.metrics && Object.keys(classification.metrics).length > 0 && (
          <div className="text-xs text-muted-foreground">
            Confiança: {classification.metrics.confidence ? `${Math.round(classification.metrics.confidence * 100)}%` : 'N/A'}
          </div>
        )}
      </div>
    );
  }

  return (
    <Badge 
      variant={getWorkoutTypeColor(classification.detected_workout_type)}
      className="flex items-center space-x-1.5 px-2 py-1 text-xs font-medium"
    >
      {getWorkoutTypeIcon(classification.detected_workout_type)}
      <span>{formatWorkoutType(classification.detected_workout_type)}</span>
    </Badge>
  );
};