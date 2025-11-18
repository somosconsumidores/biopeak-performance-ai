import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
} from 'lucide-react';

interface GPSPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  onRetry: () => Promise<boolean | void>;
  onUseSimulation: () => void;
  currentStatus: 'granted' | 'denied' | 'prompt' | 'unknown' | null;
  isEmulator: boolean;
  diagnosis: string;
}

export const GPSPermissionDialog: React.FC<GPSPermissionDialogProps> = ({
  open,
  onClose,
  onRetry,
  currentStatus,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
      onClose();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'prompt':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <MapPin className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (currentStatus) {
      case 'granted':
        return 'Permissão Concedida';
      case 'denied':
        return 'Permissão Negada';
      case 'prompt':
        return 'Permissão Pendente';
      case 'unknown':
        return 'Verificando Permissão';
      default:
        return 'Status Desconhecido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Configuração de GPS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Current */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>
            <Badge variant={currentStatus === 'granted' ? 'default' : 'destructive'}>
              {currentStatus || 'N/A'}
            </Badge>
          </div>

          {/* Prominent Disclosure - Google Play Requirement */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    Por que precisamos da sua localização?
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    O BioPeak usa sua localização <strong>apenas durante os treinos</strong> para:
                  </p>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>Rastrear distância e percurso em tempo real</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>Calcular velocidade, ritmo e pace</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>Registrar altitude e elevação do trajeto</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>Gerar mapas das suas atividades</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Seus dados são <strong>privados</strong> e <strong>nunca compartilhados</strong> com terceiros.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying}
              className="w-full"
              variant="default"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Tentando...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Solicitar Permissão GPS
                </>
              )}
            </Button>

            <Button 
              onClick={onClose}
              variant="ghost" 
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};