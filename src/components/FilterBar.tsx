import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOptions {
  period?: '7d' | '30d' | '3m' | '6m' | '1y' | 'all';
  activityType?: 'all' | 'running' | 'cycling' | 'swimming' | 'walking' | 'other';
}

interface FilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  className?: string;
  showActivityType?: boolean;
  showPeriod?: boolean;
}

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '1y', label: 'Último ano' },
  { value: 'all', label: 'Todos os dados' }
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'Todas as atividades' },
  { value: 'running', label: 'Corrida' },
  { value: 'cycling', label: 'Ciclismo' },
  { value: 'swimming', label: 'Natação' },
  { value: 'walking', label: 'Caminhada' },
  { value: 'other', label: 'Outras' }
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  className,
  showActivityType = true,
  showPeriod = true
}) => {
  const activeFiltersCount = Object.values(filters).filter(value => value && value !== 'all').length;

  const clearFilters = () => {
    onFiltersChange({ period: 'all', activityType: 'all' });
  };

  const updateFilter = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className={cn(
      "flex flex-col sm:flex-row gap-4 p-4 glass-card border-glass-border",
      className
    )}>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 flex-1">
        {showPeriod && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={filters.period || 'all'} 
              onValueChange={(value) => updateFilter('period', value)}
            >
              <SelectTrigger className="w-[180px] glass-card border-glass-border">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="glass-card border-glass-border">
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showActivityType && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={filters.activityType || 'all'} 
              onValueChange={(value) => updateFilter('activityType', value)}
            >
              <SelectTrigger className="w-[200px] glass-card border-glass-border">
                <SelectValue placeholder="Tipo de atividade" />
              </SelectTrigger>
              <SelectContent className="glass-card border-glass-border">
                {ACTIVITY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Active filters and clear button */}
      <div className="flex items-center gap-2">
        {activeFiltersCount > 0 && (
          <>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Limpar
            </Button>
          </>
        )}
      </div>
    </div>
  );
};