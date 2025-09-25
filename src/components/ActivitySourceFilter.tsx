import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'

type ActivitySource = 'ALL' | 'GARMIN' | 'STRAVA' | 'POLAR' | 'ZEPP' | 'ZEPP_GPX' | 'HEALTHKIT' | 'BIOPEAK'

interface ActivitySourceFilterProps {
  selectedSource: ActivitySource
  onSourceChange: (source: ActivitySource) => void
  activityCounts: Record<ActivitySource, number>
}

const sourceLabels: Record<ActivitySource, string> = {
  ALL: 'Todas',
  GARMIN: 'Garmin',
  STRAVA: 'Strava', 
  POLAR: 'Polar',
  ZEPP: 'Zepp Sync',
  ZEPP_GPX: 'Zepp GPX',
  HEALTHKIT: 'Apple Health',
  BIOPEAK: 'BioPeak'
}

const sourceColors: Record<ActivitySource, string> = {
  ALL: 'bg-muted',
  GARMIN: 'bg-blue-100 text-blue-800',
  STRAVA: 'bg-orange-100 text-orange-800',
  POLAR: 'bg-cyan-100 text-cyan-800', 
  ZEPP: 'bg-green-100 text-green-800',
  ZEPP_GPX: 'bg-emerald-100 text-emerald-800',
  HEALTHKIT: 'bg-red-100 text-red-800',
  BIOPEAK: 'bg-purple-100 text-purple-800'
}

export function ActivitySourceFilter({ selectedSource, onSourceChange, activityCounts }: ActivitySourceFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const sources: ActivitySource[] = ['ALL', 'GARMIN', 'STRAVA', 'POLAR', 'ZEPP', 'ZEPP_GPX', 'HEALTHKIT', 'BIOPEAK']
  const availableSources = sources.filter(source => 
    source === 'ALL' || (activityCounts[source] || 0) > 0
  )

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filtrar por fonte</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto"
          >
            {isExpanded ? 'Ocultar' : 'Mostrar todas'}
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {availableSources
            .slice(0, isExpanded ? undefined : 4)
            .map(source => (
              <Badge
                key={source}
                variant={selectedSource === source ? 'default' : 'secondary'}
                className={`cursor-pointer transition-all ${
                  selectedSource === source 
                    ? 'ring-2 ring-primary ring-offset-1' 
                    : sourceColors[source]
                }`}
                onClick={() => onSourceChange(source)}
              >
                {sourceLabels[source]}
                {source !== 'ALL' && (
                  <span className="ml-1 text-xs">
                    ({activityCounts[source] || 0})
                  </span>
                )}
              </Badge>
            ))}
        </div>
        
        {!isExpanded && availableSources.length > 4 && (
          <div className="mt-2 text-sm text-muted-foreground">
            +{availableSources.length - 4} mais fontes disponíveis
          </div>
        )}
      </CardContent>
    </Card>
  )
}