import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Target, 
  TrendingUp, 
  ExternalLink,
  MoreVertical,
  Edit,
  Trash2,
  BarChart3
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TargetRace, useTargetRaces } from "@/hooks/useTargetRaces";
import { useRaceAnalysis } from "@/hooks/useRaceAnalysis";
import { AddRaceDialog } from "./AddRaceDialog";
import { RaceAnalysisDialog } from "./RaceAnalysisDialog";

interface RaceCardProps {
  race: TargetRace;
}

export function RaceCard({ race }: RaceCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const { deleteRace } = useTargetRaces();
  const { formatTime } = useRaceAnalysis();

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(0)}K`;
    }
    return `${meters}m`;
  };

  const getDaysUntilRace = (raceDate: string) => {
    const today = new Date();
    const race = new Date(raceDate);
    const diffTime = race.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planned': return 'Planejada';
      case 'completed': return 'Concluída';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const daysUntil = getDaysUntilRace(race.race_date);
  const isPast = daysUntil < 0;
  const isToday = daysUntil === 0;
  const isUpcoming = race.status === 'planned' && !isPast;

  const handleAnalyze = () => {
    setShowAnalysisDialog(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir esta prova?')) {
      await deleteRace(race.id);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg leading-tight mb-2">
                {race.race_name}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(race.race_date).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {formatDistance(race.distance_meters)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(race.status)}>
                {getStatusLabel(race.status)}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                   {isUpcoming && (
                    <DropdownMenuItem onClick={handleAnalyze}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analisar Prontidão
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Time and Location */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              {race.target_time_minutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Meta: {formatTime(race.target_time_minutes)}</span>
                </div>
              )}
              
              {race.race_location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{race.race_location}</span>
                </div>
              )}
            </div>

            {/* Days until race */}
            {isUpcoming && (
              <div className="text-center">
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  daysUntil <= 7 
                    ? 'bg-red-500/10 text-red-700' 
                    : daysUntil <= 30 
                    ? 'bg-yellow-500/10 text-yellow-700'
                    : 'bg-blue-500/10 text-blue-700'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                  {isToday 
                    ? 'Hoje é o dia!' 
                    : daysUntil === 1 
                    ? 'Amanhã' 
                    : `${daysUntil} dias`
                  }
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {race.race_url && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(race.race_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Site
                </Button>
              )}
              
              {isUpcoming && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleAnalyze}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Análise
                </Button>
              )}
            </div>

            {/* Notes */}
            {race.notes && (
              <div className="text-sm text-muted-foreground border-t pt-3">
                <p className="line-clamp-2">{race.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AddRaceDialog 
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        race={race}
      />

      <RaceAnalysisDialog 
        open={showAnalysisDialog}
        onOpenChange={setShowAnalysisDialog}
        race={race}
      />
    </>
  );
}