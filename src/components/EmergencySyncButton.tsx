
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWebhookOnlyGarminSync } from '@/hooks/useWebhookOnlyGarminSync';
import { 
  ShieldAlert, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';

export function EmergencySyncButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const { emergencySync, isLoading } = useWebhookOnlyGarminSync();

  const handleEmergencySync = async () => {
    const success = await emergencySync(confirmationCode);
    if (success) {
      setIsOpen(false);
      setConfirmationCode('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
        >
          <ShieldAlert className="h-4 w-4 mr-2" />
          Sync de Emergência
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            <ShieldAlert className="h-5 w-5" />
            Sincronização de Emergência
          </DialogTitle>
          <DialogDescription>
            Use apenas em casos de emergência quando os webhooks não estão funcionando
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-400">
              <strong>⚠️ ATENÇÃO:</strong> Esta função pode gerar "unprompted notifications" 
              na Garmin e deve ser usada apenas quando os webhooks estão indisponíveis.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Digite o código de confirmação:
            </label>
            <Input
              placeholder="EMERGENCY_SYNC_CONFIRMED"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEmergencySync}
              disabled={isLoading || confirmationCode !== 'EMERGENCY_SYNC_CONFIRMED'}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Executar Sync de Emergência
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
