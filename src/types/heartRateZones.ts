export interface HRZoneConfig {
  minPercent: number;
  maxPercent: number;
  label: string;
}

export interface HRZonesConfig {
  zone1: HRZoneConfig;
  zone2: HRZoneConfig;
  zone3: HRZoneConfig;
  zone4: HRZoneConfig;
  zone5: HRZoneConfig;
}

export const DEFAULT_HR_ZONES: HRZonesConfig = {
  zone1: { minPercent: 50, maxPercent: 60, label: 'Recuperação' },
  zone2: { minPercent: 60, maxPercent: 70, label: 'Aeróbica' },
  zone3: { minPercent: 70, maxPercent: 80, label: 'Limiar' },
  zone4: { minPercent: 80, maxPercent: 90, label: 'Anaeróbica' },
  zone5: { minPercent: 90, maxPercent: 100, label: 'Máxima' },
};

export const ZONE_COLORS = {
  zone1: 'bg-blue-500',
  zone2: 'bg-green-500',
  zone3: 'bg-yellow-500',
  zone4: 'bg-orange-500',
  zone5: 'bg-red-500',
};

export const HR_ZONE_PRESETS = {
  default: {
    name: 'Padrão (5 zonas)',
    zones: DEFAULT_HR_ZONES,
  },
  competitive: {
    name: 'Corrida competitiva',
    zones: {
      zone1: { minPercent: 50, maxPercent: 60, label: 'Recuperação ativa' },
      zone2: { minPercent: 60, maxPercent: 70, label: 'Base aeróbica' },
      zone3: { minPercent: 70, maxPercent: 80, label: 'Tempo' },
      zone4: { minPercent: 80, maxPercent: 90, label: 'Limiar anaeróbico' },
      zone5: { minPercent: 90, maxPercent: 100, label: 'VO2max' },
    },
  },
  beginner: {
    name: 'Iniciante',
    zones: {
      zone1: { minPercent: 50, maxPercent: 65, label: 'Leve' },
      zone2: { minPercent: 65, maxPercent: 75, label: 'Moderado' },
      zone3: { minPercent: 75, maxPercent: 85, label: 'Intenso' },
      zone4: { minPercent: 85, maxPercent: 92, label: 'Muito intenso' },
      zone5: { minPercent: 92, maxPercent: 100, label: 'Máximo' },
    },
  },
};
