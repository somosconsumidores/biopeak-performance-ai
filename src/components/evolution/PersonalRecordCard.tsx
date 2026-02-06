import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonalRecord, SportCategory } from '@/hooks/usePersonalRecords';
import { Trophy, Bike, Waves } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PersonalRecordCardProps {
  category: SportCategory;
  records: PersonalRecord[];
}

const CATEGORY_CONFIG: Record<SportCategory, {
  label: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  bgGradient: string;
}> = {
  RUNNING: {
    label: 'Corrida',
    subtitle: 'Em segmentos de 1km',
    icon: Trophy,
    iconColor: 'text-orange-500',
    bgGradient: 'from-orange-500/10 to-orange-500/5',
  },
  CYCLING: {
    label: 'Ciclismo',
    subtitle: 'Em segmentos de 1km',
    icon: Bike,
    iconColor: 'text-blue-500',
    bgGradient: 'from-blue-500/10 to-blue-500/5',
  },
  SWIMMING: {
    label: 'Natação',
    subtitle: 'Em segmentos de 100 metros',
    icon: Waves,
    iconColor: 'text-cyan-500',
    bgGradient: 'from-cyan-500/10 to-cyan-500/5',
  },
};

const MEDAL_STYLES: Record<number, { emoji: string; textClass: string }> = {
  1: { emoji: '🥇', textClass: 'text-yellow-500 font-bold' },
  2: { emoji: '🥈', textClass: 'text-gray-400 font-semibold' },
  3: { emoji: '🥉', textClass: 'text-amber-600 font-medium' },
};

export function PersonalRecordCard({ category, records }: PersonalRecordCardProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={`bg-gradient-to-br ${config.bgGradient} border-border/50 min-w-[280px] flex-shrink-0`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
          {config.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{config.subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sem recordes ainda
          </p>
        ) : (
          <div className="space-y-2">
            {records.map((record) => {
              const medal = MEDAL_STYLES[record.rank_position] || MEDAL_STYLES[3];
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{medal.emoji}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(record.activity_date)}
                    </span>
                  </div>
                  <span className={`text-sm ${medal.textClass}`}>
                    {record.formatted_pace}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
