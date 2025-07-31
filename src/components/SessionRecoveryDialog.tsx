import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SessionData } from '@/hooks/useRealtimeSession';

interface SessionRecoveryDialogProps {
  isOpen: boolean;
  onRecover: () => void;
  onDiscard: () => void;
  sessionData: SessionData | null;
  hibernationDuration: number;
}

export const SessionRecoveryDialog: React.FC<SessionRecoveryDialogProps> = ({
  isOpen,
  onRecover,
  onDiscard,
  sessionData,
  hibernationDuration,
}) => {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(2)} km` : `${meters.toFixed(0)} m`;
  };

  const hibernationMinutes = Math.floor(hibernationDuration / 60000);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🔄</span>
            Sessão de Treino Interrompida
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Detectamos que sua sessão de treino foi interrompida há{' '}
              <span className="font-semibold text-foreground">{hibernationMinutes} minutos</span>.
            </p>
            
            {sessionData && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Progresso da sessão:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Distância:</span>
                    <span className="ml-1 font-medium">
                      {formatDistance(sessionData.currentDistance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tempo:</span>
                    <span className="ml-1 font-medium">
                      {formatDuration(sessionData.currentDuration)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <p className="text-sm">
              Deseja continuar de onde parou ou iniciar uma nova sessão?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onDiscard}
            className="order-2 sm:order-1"
          >
            Iniciar Nova Sessão
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onRecover}
            className="order-1 sm:order-2"
          >
            Continuar Sessão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};