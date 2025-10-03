import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RaceInputs } from "@/components/race-planning/RaceInputs";
import { StrategyControls } from "@/components/race-planning/StrategyControls";
import { PaceDistributionTable } from "@/components/race-planning/PaceDistributionTable";
import { PaceChart } from "@/components/race-planning/PaceChart";
import { useRacePlanning } from "@/hooks/useRacePlanning";
import { AlertCircle, Trophy, Download, Share2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RacePlanning() {
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
  } = useRacePlanning();

  const handleSave = () => {
    // TODO: Implement save to user profile
    console.log('Saving race plan...');
  };

  const handleExport = () => {
    // TODO: Implement PDF export
    console.log('Exporting to PDF...');
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Sharing race plan...');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center px-2">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Planejador de Prova
            </h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Planeje sua estratégia de corrida com precisão. Defina seu objetivo e descubra a melhor distribuição de pace para alcançar seu melhor desempenho.
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
              <Button onClick={handleSave} className="w-full h-11 sm:h-10 text-sm sm:text-base">
                <Trophy className="h-4 w-4 mr-2" />
                Salvar Estratégia
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
  );
}
