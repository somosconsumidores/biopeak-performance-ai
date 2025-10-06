import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Smartphone,
  Chrome,
  Globe,
  Lock
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
  onUseSimulation,
  currentStatus,
  isEmulator,
  diagnosis
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{
    browser: string;
    os: string;
    isHttps: boolean;
  }>({
    browser: 'Unknown',
    os: 'Unknown',
    isHttps: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isHttps = window.location.protocol === 'https:';
    
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Detect OS
    if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';

    setDeviceInfo({ browser, os, isHttps });
  }, []);

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
      case 'unknown':
        return <Settings className="h-5 w-5 text-gray-500" />;
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

  const getBrowserSpecificInstructions = () => {
    const instructions = {
      Chrome: [
        'Clique no ícone 🔒 ou 🛡️ na barra de endereços',
        'Selecione "Localização" → "Permitir"',
        'Recarregue a página e tente novamente'
      ],
      Firefox: [
        'Clique no ícone 🛡️ à esquerda da URL',
        'Clique em "Permissões" → "Localização"',
        'Selecione "Permitir" e recarregue'
      ],
      Safari: [
        'Vá em Safari → Preferências → Sites',
        'Selecione "Localização" no menu lateral',
        'Altere para "Permitir" para este site'
      ],
      Edge: [
        'Clique no ícone 🔒 na barra de endereços',
        'Clique em "Permissões para este site"',
        'Altere "Localização" para "Permitir"'
      ]
    };

    return instructions[deviceInfo.browser as keyof typeof instructions] || instructions.Chrome;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Device Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>{deviceInfo.browser}</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span>{deviceInfo.os}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>{deviceInfo.isHttps ? 'HTTPS' : 'HTTP'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>{isEmulator ? 'Emulador' : 'Dispositivo'}</span>
            </div>
          </div>

          <Separator />

          {/* Security Warning */}
          {!deviceInfo.isHttps && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> A geolocalização requer HTTPS para funcionar em dispositivos reais. 
                Acesse via HTTPS ou use o modo simulação.
              </AlertDescription>
            </Alert>
          )}

          {/* Emulator Info */}
          {isEmulator && (
            <Alert className="border-blue-200 bg-blue-50">
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <strong>Emulador Detectado:</strong> Configure a localização nas configurações do emulador 
                ou use o modo simulação para testes.
              </AlertDescription>
            </Alert>
          )}

          {/* Permission Denied Info */}
          {currentStatus === 'denied' && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Permissão Negada:</strong> Para usar recursos de GPS, você pode habilitar 
                a permissão nas configurações do seu dispositivo ou usar o modo simulação para testes.
              </AlertDescription>
            </Alert>
          )}

          {/* Troubleshooting */}
          {currentStatus === 'prompt' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aguardando sua resposta. Clique em "Permitir" quando o navegador solicitar 
                acesso à localização, ou tente solicitar novamente.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-2">
            {currentStatus !== 'denied' && (
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
            )}

            <Button 
              onClick={onUseSimulation}
              variant="outline" 
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Usar Modo Simulação
            </Button>

            <Button 
              onClick={onClose}
              variant="ghost" 
              className="w-full"
            >
              Fechar
            </Button>
          </div>

          {/* Debug Info */}
          {diagnosis && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Informações Técnicas</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                {diagnosis}
              </pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};