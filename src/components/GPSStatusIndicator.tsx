import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  MapPin, 
  MapPinOff, 
  AlertTriangle, 
  CheckCircle, 
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';

interface GPSStatusIndicatorProps {
  status: 'granted' | 'denied' | 'prompt' | 'unknown' | null;
  isTracking: boolean;
  isSimulationMode: boolean;
  accuracy?: number;
  lastUpdate?: number;
  onRequestPermission?: () => void;
}

export const GPSStatusIndicator: React.FC<GPSStatusIndicatorProps> = ({
  status,
  isTracking,
  isSimulationMode,
  accuracy,
  lastUpdate,
  onRequestPermission
}) => {
  const getStatusInfo = () => {
    if (isSimulationMode) {
      return {
        icon: Settings,
        text: 'Simulação',
        color: 'bg-blue-500',
        variant: 'secondary' as const,
        description: 'Usando GPS simulado para desenvolvimento/testes'
      };
    }

    if (!status || status === 'prompt') {
      return {
        icon: AlertTriangle,
        text: 'Pendente',
        color: 'bg-yellow-500',
        variant: 'outline' as const,
        description: 'Permissão de GPS pendente - clique para configurar'
      };
    }

    if (status === 'denied') {
      return {
        icon: MapPinOff,
        text: 'Negado',
        color: 'bg-red-500',
        variant: 'destructive' as const,
        description: 'Permissão de GPS negada - habilite nas configurações do dispositivo'
      };
    }

    if (status === 'granted' && isTracking) {
      const accuracyText = accuracy ? `±${accuracy.toFixed(0)}m` : '';
      const timeAgo = lastUpdate ? Math.round((Date.now() - lastUpdate) / 1000) : null;
      
      return {
        icon: CheckCircle,
        text: `Ativo ${accuracyText}`,
        color: 'bg-green-500',
        variant: 'default' as const,
        description: `GPS ativo${timeAgo ? ` (atualizado ${timeAgo}s atrás)` : ''}`
      };
    }

    if (status === 'granted' && !isTracking) {
      return {
        icon: MapPin,
        text: 'Autorizado',
        color: 'bg-green-600',
        variant: 'secondary' as const,
        description: 'GPS autorizado mas não está rastreando'
      };
    }

    return {
      icon: WifiOff,
      text: 'Desconhecido',
      color: 'bg-gray-500',
      variant: 'outline' as const,
      description: 'Status do GPS desconhecido'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const handleClick = () => {
    if (status === 'prompt') {
      onRequestPermission?.();
    }
    // Don't do anything for 'denied' - user must go to Settings manually
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className="h-8 px-2 py-1"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <StatusIcon className="h-4 w-4" />
                {isTracking && !isSimulationMode && (
                  <div className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${statusInfo.color} animate-pulse`} />
                )}
              </div>
              <span className="text-xs font-medium">{statusInfo.text}</span>
              {isTracking && !isSimulationMode && (
                <Wifi className="h-3 w-3 text-green-500" />
              )}
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{statusInfo.description}</p>
          {status === 'prompt' && (
            <p className="text-xs text-muted-foreground mt-1">
              Clique para solicitar permissão
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};