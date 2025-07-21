
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useBackfillActivities } from '@/hooks/useBackfillActivities';
import { History, Download, Calendar, Clock } from 'lucide-react';

export function BackfillActivitiesDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'last_30_days' | 'custom'>('last_30_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { backfillActivities, isLoading, lastBackfillResult } = useBackfillActivities();

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <History className="h-4 w-4 mr-2" />
          Buscar Atividades Históricas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Buscar Atividades Históricas
          </DialogTitle>
          <DialogDescription>
            Busque e importe atividades anteriores da sua conta Garmin Connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                    Período personalizado
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
                </div>
              )}
            </CardContent>
          </Card>

          {lastBackfillResult && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-400">Última Busca</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Atividades encontradas:</span>
                  <Badge variant="secondary">{lastBackfillResult.activitiesSaved}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Período:</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(lastBackfillResult.startDate).toLocaleDateString('pt-BR')} - {new Date(lastBackfillResult.endDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {lastBackfillResult.chunksFailed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Períodos com falha:</span>
                    <Badge variant="destructive" className="text-xs">{lastBackfillResult.chunksFailed}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              {isLoading ? 'Buscando...' : 'Buscar Atividades'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
