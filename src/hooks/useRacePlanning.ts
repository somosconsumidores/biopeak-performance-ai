import { useState, useMemo, useEffect } from 'react';

export type RaceDistance = '5k' | '10k' | '21k' | '42k' | 'custom';
export type ObjectiveType = 'time' | 'pace';
export type StrategyType = 'constant' | 'negative' | 'positive';

export interface KmData {
  km: number;
  pace: number; // em segundos por km
  time: number; // tempo para este km em segundos
  accumulatedTime: number; // tempo acumulado em segundos
}

export function useRacePlanning(initialData?: {
  distance: RaceDistance;
  customDistance: number;
  objectiveType: ObjectiveType;
  targetTime: string;
  targetPace: string;
  strategy: StrategyType;
  intensity: number;
}) {
  const [distance, setDistance] = useState<RaceDistance>(initialData?.distance || '10k');
  const [customDistance, setCustomDistance] = useState<number>(initialData?.customDistance || 10);
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>(initialData?.objectiveType || 'time');
  const [targetTime, setTargetTime] = useState<string>(initialData?.targetTime || '01:00:00'); // HH:MM:SS
  const [targetPace, setTargetPace] = useState<string>(initialData?.targetPace || '06:00'); // MM:SS
  const [strategy, setStrategy] = useState<StrategyType>(initialData?.strategy || 'constant');
  const [intensity, setIntensity] = useState<number>(initialData?.intensity || 10); // 0-20% variation

  // Update states when initialData changes (when loading a saved strategy)
  useEffect(() => {
    if (initialData) {
      setDistance(initialData.distance);
      setCustomDistance(initialData.customDistance);
      setObjectiveType(initialData.objectiveType);
      setTargetTime(initialData.targetTime);
      setTargetPace(initialData.targetPace);
      setStrategy(initialData.strategy);
      setIntensity(initialData.intensity);
    }
  }, [initialData]);

  const distanceInKm = useMemo(() => {
    switch (distance) {
      case '5k': return 5;
      case '10k': return 10;
      case '21k': return 21.097;
      case '42k': return 42.195;
      case 'custom': return customDistance;
      default: return 10;
    }
  }, [distance, customDistance]);

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const [h, m, s] = parts.map(Number);
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const [m, s] = parts.map(Number);
      return m * 60 + s;
    }
    return 0;
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceSeconds: number): string => {
    const m = Math.floor(paceSeconds / 60);
    const s = Math.floor(paceSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const avgPaceSeconds = useMemo(() => {
    if (objectiveType === 'time') {
      const totalSeconds = parseTime(targetTime);
      return totalSeconds / distanceInKm;
    } else {
      return parseTime(targetPace);
    }
  }, [objectiveType, targetTime, targetPace, distanceInKm]);

  const totalTimeSeconds = useMemo(() => {
    return avgPaceSeconds * distanceInKm;
  }, [avgPaceSeconds, distanceInKm]);

  const kmDistribution = useMemo((): KmData[] => {
    const data: KmData[] = [];
    const numKm = Math.ceil(distanceInKm);
    const intensityFactor = intensity / 100; // 0 to 0.20

    for (let i = 1; i <= numKm; i++) {
      let pace = avgPaceSeconds;
      const progress = i / numKm;

      if (strategy === 'negative') {
        // Começa mais lento, termina mais rápido
        const variation = avgPaceSeconds * intensityFactor;
        pace = avgPaceSeconds + variation * (1 - progress) - variation * progress;
      } else if (strategy === 'positive') {
        // Começa mais rápido, termina mais lento
        const variation = avgPaceSeconds * intensityFactor;
        pace = avgPaceSeconds - variation * (1 - progress) + variation * progress;
      }

      const isLastKm = i === numKm;
      const kmDistance = isLastKm ? distanceInKm - (numKm - 1) : 1;
      const time = pace * kmDistance;
      const accumulatedTime = i === 1 ? time : data[i - 2].accumulatedTime + time;

      data.push({
        km: i,
        pace,
        time,
        accumulatedTime,
      });
    }

    return data;
  }, [distanceInKm, avgPaceSeconds, strategy, intensity]);

  const getCoachingMessage = (): string => {
    if (strategy === 'constant') {
      return 'Mantenha o ritmo constante do início ao fim. Controle é a chave!';
    } else if (strategy === 'negative') {
      if (intensity > 15) {
        return 'Atenção: Final muito forte! Reserve energia para a segunda metade.';
      }
      return 'Estratégia inteligente: acelere gradualmente na segunda metade.';
    } else {
      if (intensity > 15) {
        return 'Cuidado: Início muito rápido pode comprometer o final.';
      }
      return 'Comece forte, mas controle para não perder muito ritmo no final.';
    }
  };

  return {
    distance,
    setDistance,
    customDistance,
    setCustomDistance,
    objectiveType,
    setObjectiveType,
    targetTime,
    setTargetTime,
    targetPace,
    setTargetPace,
    strategy,
    setStrategy,
    intensity,
    setIntensity,
    distanceInKm,
    avgPaceSeconds,
    totalTimeSeconds,
    kmDistribution,
    formatTime,
    formatPace,
    getCoachingMessage,
  };
}
