import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Camera, Mic, Settings } from 'lucide-react';

interface FeatureRequiresPermissionProps {
  type: 'location' | 'camera' | 'microphone';
  feature: string;
}

export const FeatureRequiresPermission: React.FC<FeatureRequiresPermissionProps> = ({
  type,
  feature
}) => {
  const getIcon = () => {
    switch (type) {
      case 'location':
        return <MapPin className="h-4 w-4" />;
      case 'camera':
        return <Camera className="h-4 w-4" />;
      case 'microphone':
        return <Mic className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getPermissionName = () => {
    switch (type) {
      case 'location':
        return 'Localização';
      case 'camera':
        return 'Câmera';
      case 'microphone':
        return 'Microfone';
      default:
        return 'Permissão';
    }
  };

  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      {getIcon()}
      <AlertTitle className="text-sm font-semibold">
        {getPermissionName()} Necessária
      </AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p>
          Para {feature}, você precisa habilitar a permissão de {getPermissionName().toLowerCase()}.
        </p>
        <p className="text-muted-foreground">
          <strong>Como habilitar:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
          <li>Vá em <strong>Ajustes</strong> (Settings) do seu dispositivo</li>
          <li>Busque por <strong>BioPeak</strong></li>
          <li>Toque em <strong>Permissões</strong></li>
          <li>Ative <strong>{getPermissionName()}</strong></li>
        </ol>
      </AlertDescription>
    </Alert>
  );
};
