
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBackfillActivities } from '@/hooks/useBackfillActivities';
import { useBackfillRequests } from '@/hooks/useBackfillRequests';
import { History, Download, Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function BackfillActivitiesDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'last_30_days' | 'custom'>('last_30_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { backfillActivities, isLoading, lastBackfillResult } = useBackfillActivities();
  const { 
    requests, 
    isLoading: requestsLoading, 
    getActiveRequests, 
    getCompletedRequests,
    formatTimeRange,
    getStatusBadgeVariant,
    getStatusText
  } = useBackfillRequests();

  const handleBackfill = async () => {
    let request: any = { timeRange };

    if (timeRange === 'custom') {
      if (!startDate || !endDate) {
        return;
      }
      
      const start = Math.floor(new Date(startDate).getTime() / 1000);
      const end = Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000);
      
      request = { timeRange, start, end };
    }

    const success = await backfillActivities(request);
    if (success) {
      setIsOpen(false);
    }
  };

  const activeRequests = getActiveRequests();
  const completedRequests = getCompletedRequests().slice(0, 5); // Show last 5 completed

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <History className="h-4 w-4 mr-2" />
          Buscar Atividades Históricas
          {activeRequests.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeRequests.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Buscar Atividades Históricas
          </DialogTitle>
          <DialogDescription>
            Busque e importe atividades anteriores da sua conta Garmin Connect. Os detalhes das atividades chegam via webhook em alguns minutos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6">
            {/* Active Requests */}
            {activeRequests.length > 0 && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Backfills em Progresso ({activeRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeRequests.map((request) => (
                    <div key={request.id} className="flex justify-between items-center text-sm">
                      <span>{formatTimeRange(request.time_range_start, request.time_range_end)}</span>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Time Range Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Período</CardTitle>
                <CardDescription>
                  Escolha o período das atividades que deseja importar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={timeRange} onValueChange={(value: 'last_30_days' | 'custom') => setTimeRange(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="last_30_days" id="last_30_days" />
                    <Label htmlFor="last_30_days" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Últimos 30 dias
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Período personalizado (máx. 30 dias)
                    </Label>
                  </div>
                </RadioGroup>

                {timeRange === 'custom' && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                          Data inicial
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                          Data final
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {startDate && endDate && (
                      <div className="text-xs text-muted-foreground">
                        Período selecionado: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} dias
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Last Result */}
            {lastBackfillResult && (
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-green-400">Último Backfill</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Atividades encontradas:</span>
                    <Badge variant="secondary">{lastBackfillResult.activities?.found || 0}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Atividades salvas:</span>
                    <Badge variant="secondary">{lastBackfillResult.activities?.saved || 0}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Detalhes acionados:</span>
                    <Badge variant="secondary">{lastBackfillResult.activityDetails?.triggered || 0}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Período:</span>
                    <span className="text-xs text-muted-foreground">
                      {lastBackfillResult.startDate && lastBackfillResult.endDate && (
                        `${new Date(lastBackfillResult.startDate).toLocaleDateString('pt-BR')} - ${new Date(lastBackfillResult.endDate).toLocaleDateString('pt-BR')}`
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Completed Requests */}
            {completedRequests.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Backfills Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {completedRequests.map((request) => (
                    <div key={request.id} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span>{formatTimeRange(request.time_range_start, request.time_range_end)}</span>
                        <span className="text-xs text-muted-foreground">
                          {request.activity_details_received} detalhes recebidos
                        </span>
                      </div>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleBackfill}
                disabled={isLoading || (timeRange === 'custom' && (!startDate || !endDate))}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  'Iniciar Backfill'
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
