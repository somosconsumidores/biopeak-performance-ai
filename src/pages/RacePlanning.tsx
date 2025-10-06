import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RaceInputs } from "@/components/race-planning/RaceInputs";
import { StrategyControls } from "@/components/race-planning/StrategyControls";
import { PaceDistributionTable } from "@/components/race-planning/PaceDistributionTable";
import { PaceChart } from "@/components/race-planning/PaceChart";
import { SaveStrategyDialog } from "@/components/race-planning/SaveStrategyDialog";
import { useRacePlanning } from "@/hooks/useRacePlanning";
import { useRaceStrategies } from "@/hooks/useRaceStrategies";
import { AlertCircle, Trophy, Download, Share2, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { exportStrategyToPDF } from "@/utils/pdfExport";
import { shareStrategyNative } from "@/utils/shareStrategy";

export default function RacePlanning() {
  const [searchParams] = useSearchParams();
  const strategyId = searchParams.get('id');
  const { toast } = useToast();
  const { loadStrategy, saveStrategy, updateStrategy, isLoading: isSaving } = useRaceStrategies();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loadedStrategyId, setLoadedStrategyId] = useState<string | null>(null);
  const [loadedStrategyName, setLoadedStrategyName] = useState<string>('');
  const [initialData, setInitialData] = useState<any>(null);

  // Load strategy if ID is present in URL
  useEffect(() => {
    if (strategyId) {
      loadExistingStrategy(strategyId);
    }
  }, [strategyId]);

  const loadExistingStrategy = async (id: string) => {
    const strategy = await loadStrategy(id);
    if (strategy) {
      setLoadedStrategyId(id);
      setLoadedStrategyName(strategy.strategy_name);
      
      // Convert distance to proper format
      const distanceKm = Number(strategy.distance_km);
      let distanceType: 'constant' | 'negative' | 'positive' = 'constant';
      let customDist = 10;
      
      if (distanceKm === 5) distanceType = 'constant' as any; // Will be corrected below
      else if (distanceKm === 10) distanceType = 'constant' as any;
      else if (distanceKm === 21.0975) distanceType = 'constant' as any;
      else if (distanceKm === 42.195) distanceType = 'constant' as any;
      else {
        distanceType = 'constant' as any;
        customDist = distanceKm;
      }

      // Determine proper distance format
      let dist: 'constant' | 'negative' | 'positive' | 'custom' = 'custom';
      if (distanceKm === 5) dist = '5k' as any;
      else if (distanceKm === 10) dist = '10k' as any;
      else if (Math.abs(distanceKm - 21.0975) < 0.01) dist = '21k' as any;
      else if (Math.abs(distanceKm - 42.195) < 0.01) dist = '42k' as any;

      const formatTimeFromSeconds = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };

      const formatPaceFromSeconds = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      };

      const targetTimeStr = strategy.target_time_seconds 
        ? formatTimeFromSeconds(strategy.target_time_seconds)
        : '01:00:00';
      
      const targetPaceStr = strategy.target_pace_seconds
        ? formatPaceFromSeconds(strategy.target_pace_seconds)
        : '06:00';

      setInitialData({
        distance: dist,
        customDistance: customDist,
        objectiveType: strategy.objective_type,
        targetTime: targetTimeStr,
        targetPace: targetPaceStr,
        strategy: strategy.strategy_type,
        intensity: strategy.intensity_percentage,
      });

      toast({
        title: "Estratégia Carregada",
        description: `"${strategy.strategy_name}" foi carregada com sucesso.`,
      });
    }
  };

  const {
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
  } = useRacePlanning(initialData);

  const handleSave = async (strategyName: string) => {
    const targetTimeInSeconds = objectiveType === 'time' 
      ? totalTimeSeconds 
      : null;
    
    const targetPaceInSeconds = objectiveType === 'pace'
      ? avgPaceSeconds
      : null;

    let result;
    
    // If we have a loaded strategy, update it instead of creating new
    if (loadedStrategyId) {
      result = await updateStrategy(
        loadedStrategyId,
        strategyName,
        distanceInKm,
        objectiveType,
        targetTimeInSeconds,
        targetPaceInSeconds,
        strategy,
        intensity,
        kmDistribution,
        totalTimeSeconds,
        avgPaceSeconds
      );
      
      if (result) {
        setLoadedStrategyName(strategyName);
      }
    } else {
      result = await saveStrategy(
        strategyName,
        distanceInKm,
        objectiveType,
        targetTimeInSeconds,
        targetPaceInSeconds,
        strategy,
        intensity,
        kmDistribution,
        totalTimeSeconds,
        avgPaceSeconds
      );
      
      if (result) {
        setLoadedStrategyId(result.id);
        setLoadedStrategyName(strategyName);
      }
    }

    if (result) {
      setShowSaveDialog(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportStrategyToPDF(
        loadedStrategyName || 'Minha_Estrategia',
        distanceInKm,
        formatTime(totalTimeSeconds),
        formatPace(avgPaceSeconds),
        strategy,
        kmDistribution,
        formatTime,
        formatPace
      );
      
      toast({
        title: "PDF Exportado",
        description: "Sua estratégia foi exportada com sucesso!",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    try {
      const success = await shareStrategyNative(
        loadedStrategyName || 'Minha Estratégia',
        distanceInKm,
        formatTime(totalTimeSeconds),
        formatPace(avgPaceSeconds),
        strategy
      );
      
      if (success) {
        toast({
          title: "Compartilhado!",
          description: "Sua estratégia foi compartilhada com sucesso.",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: "Erro ao compartilhar",
        description: "Não foi possível compartilhar a estratégia. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      <div className="safe-pt-20 sm:safe-pt-24 pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center px-2">
          {loadedStrategyId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Minhas Estratégias
            </Button>
          )}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {loadedStrategyId ? loadedStrategyName : 'Planejador de Prova'}
            </h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            {loadedStrategyId 
              ? 'Visualize e edite sua estratégia de corrida salva.'
              : 'Planeje sua estratégia de corrida com precisão. Defina seu objetivo e descubra a melhor distribuição de pace para alcançar seu melhor desempenho.'
            }
          </p>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Inputs */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Configuração</CardTitle>
                <CardDescription className="text-sm">Defina os parâmetros da sua prova</CardDescription>
              </CardHeader>
              <CardContent>
                <RaceInputs
                  distance={distance}
                  onDistanceChange={setDistance}
                  customDistance={customDistance}
                  onCustomDistanceChange={setCustomDistance}
                  objectiveType={objectiveType}
                  onObjectiveTypeChange={setObjectiveType}
                  targetTime={targetTime}
                  onTargetTimeChange={setTargetTime}
                  targetPace={targetPace}
                  onTargetPaceChange={setTargetPace}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Estratégia</CardTitle>
                <CardDescription className="text-sm">Escolha como distribuir o esforço</CardDescription>
              </CardHeader>
              <CardContent>
                <StrategyControls
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                  intensity={intensity}
                  onIntensityChange={setIntensity}
                />
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">Distância:</span>
                  <span className="font-mono font-medium text-sm sm:text-base">{distanceInKm.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">Tempo Total:</span>
                  <span className="font-mono font-medium text-primary text-sm sm:text-base">{formatTime(totalTimeSeconds)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">Pace Médio:</span>
                  <span className="font-mono font-medium text-primary text-sm sm:text-base">{formatPace(avgPaceSeconds)}/km</span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setShowSaveDialog(true)} 
                className="w-full h-11 sm:h-10 text-sm sm:text-base"
                disabled={isSaving}
              >
                <Trophy className="h-4 w-4 mr-2" />
                {loadedStrategyId ? 'Atualizar Estratégia' : 'Salvar Estratégia'}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleExport} className="h-11 sm:h-10 text-xs sm:text-sm">
                  <Download className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">Exportar </span>PDF
                </Button>
                <Button variant="outline" onClick={handleShare} className="h-11 sm:h-10 text-xs sm:text-sm">
                  <Share2 className="h-4 w-4 mr-1 sm:mr-2" />
                  Compartilhar
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Coaching Message */}
            <Alert className="border-primary/50 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm leading-relaxed">
                {getCoachingMessage()}
              </AlertDescription>
            </Alert>

            {/* Chart */}
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Distribuição de Pace</CardTitle>
                <CardDescription className="text-sm">Visualização do ritmo ao longo da prova</CardDescription>
              </CardHeader>
              <CardContent>
                <PaceChart
                  data={kmDistribution}
                  formatPace={formatPace}
                  avgPaceSeconds={avgPaceSeconds}
                />
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Tabela Detalhada</CardTitle>
                <CardDescription className="text-sm">Pace e tempo quilômetro a quilômetro</CardDescription>
              </CardHeader>
              <CardContent>
                <PaceDistributionTable
                  data={kmDistribution}
                  formatTime={formatTime}
                  formatPace={formatPace}
                  avgPaceSeconds={avgPaceSeconds}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>

      <SaveStrategyDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
        isLoading={isSaving}
        isUpdate={!!loadedStrategyId}
        currentName={loadedStrategyName}
      />
    </div>
  );
}
