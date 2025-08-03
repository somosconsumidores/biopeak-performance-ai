import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface OfflineRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecover: () => void;
  onDiscard: () => void;
  sessionData?: any;
}

export const OfflineRecoveryDialog = ({ 
  open, 
  onOpenChange, 
  onRecover, 
  onDiscard, 
  sessionData 
}: OfflineRecoveryDialogProps) => {
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      await onRecover();
    } finally {
      setIsRecovering(false);
      onOpenChange(false);
    }
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sessão Interrompida Detectada
          </DialogTitle>
          <DialogDescription>
            Detectamos uma sessão de treino que foi interrompida. 
            {sessionData && (
              <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                <div>Distância: {(sessionData.distance / 1000).toFixed(2)}km</div>
                <div>Duração: {Math.floor(sessionData.duration / 60)}min</div>
                <div>Última atualização: {new Date(sessionData.lastSaved).toLocaleString()}</div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={isRecovering}
          >
            Descartar
          </Button>
          <Button
            onClick={handleRecover}
            disabled={isRecovering}
            className="flex items-center gap-2"
          >
            {isRecovering && <RefreshCw className="h-4 w-4 animate-spin" />}
            Recuperar Sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};