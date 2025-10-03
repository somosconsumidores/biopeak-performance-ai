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
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Planejador de Prova
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Planeje sua estratégia de corrida com precisão. Defina seu objetivo e descubra a melhor distribuição de pace para alcançar seu melhor desempenho.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Inputs */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração</CardTitle>
                <CardDescription>Defina os parâmetros da sua prova</CardDescription>
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
              <CardHeader>
                <CardTitle>Estratégia</CardTitle>
                <CardDescription>Escolha como distribuir o esforço</CardDescription>
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
              <CardHeader>
                <CardTitle className="text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Distância:</span>
                  <span className="font-mono font-medium">{distanceInKm.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tempo Total:</span>
                  <span className="font-mono font-medium text-primary">{formatTime(totalTimeSeconds)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pace Médio:</span>
                  <span className="font-mono font-medium text-primary">{formatPace(avgPaceSeconds)}/km</span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button onClick={handleSave} className="w-full">
                <Trophy className="h-4 w-4 mr-2" />
                Salvar Estratégia
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Coaching Message */}
            <Alert className="border-primary/50 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                {getCoachingMessage()}
              </AlertDescription>
            </Alert>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Pace</CardTitle>
                <CardDescription>Visualização do ritmo ao longo da prova</CardDescription>
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
              <CardHeader>
                <CardTitle>Tabela Detalhada</CardTitle>
                <CardDescription>Pace e tempo quilômetro a quilômetro</CardDescription>
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
