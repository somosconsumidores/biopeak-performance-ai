import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRaceStrategies, SavedRaceStrategy } from "@/hooks/useRaceStrategies";
import { Trophy, Clock, Activity, Trash2, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SavedStrategies() {
  const navigate = useNavigate();
  const { loadStrategies, deleteStrategy, isLoading } = useRaceStrategies();
  const [strategies, setStrategies] = useState<SavedRaceStrategy[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await loadStrategies();
    setStrategies(data);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const success = await deleteStrategy(deleteId);
    if (success) {
      setStrategies(strategies.filter(s => s.id !== deleteId));
    }
    setDeleteId(null);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatPace = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getStrategyLabel = (type: string) => {
    switch (type) {
      case 'constant':
        return 'Pace Constante';
      case 'negative':
        return 'Negative Split';
      case 'positive':
        return 'Positive Split';
      default:
        return type;
    }
  };

  if (isLoading && strategies.length === 0) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="safe-pt-20 sm:safe-pt-24 pb-12 px-3 sm:px-4 md:px-6 lg:px-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando estratégias...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      <div className="safe-pt-20 sm:safe-pt-24 pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Minhas Estratégias
              </h1>
            </div>
            <Button onClick={() => navigate('/race-planning')} className="text-sm sm:text-base">
              <Trophy className="h-4 w-4 mr-2" />
              Nova Estratégia
            </Button>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie suas estratégias de corrida salvas
          </p>
        </div>

        {/* Strategies List */}
        {strategies.length === 0 ? (
          <Card className="p-8 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma estratégia salva</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira estratégia de corrida no planejador
            </p>
            <Button onClick={() => navigate('/race-planning')}>
              Criar Estratégia
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-start justify-between">
                    <span className="pr-2 line-clamp-2">{strategy.strategy_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => setDeleteId(strategy.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(strategy.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Distância:
                    </span>
                    <span className="font-mono font-medium">{strategy.distance_km.toFixed(2)} km</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Tempo Total:
                    </span>
                    <span className="font-mono font-medium text-primary">
                      {formatTime(strategy.total_time_seconds)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pace Médio:</span>
                    <span className="font-mono font-medium text-primary">
                      {formatPace(strategy.avg_pace_seconds)}/km
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Estratégia:</span>
                    <p className="text-sm font-medium mt-1">{getStrategyLabel(strategy.strategy_type)}</p>
                  </div>

                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => navigate(`/race-planning?id=${strategy.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta estratégia? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
