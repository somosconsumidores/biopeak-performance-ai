import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { MapPin, Camera, Mic, CheckCircle, XCircle, Clock, Settings } from 'lucide-react';
import { useNativePermissions } from '../hooks/useNativePermissions';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface PermissionOnboardingProps {
  open: boolean;
  onComplete: () => void;
}

export const PermissionOnboarding: React.FC<PermissionOnboardingProps> = ({
  open,
  onComplete
}) => {
  const { permissions, requestAllPermissions, isNative, deviceInfo } = useNativePermissions();
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasTriedRequest, setHasTriedRequest] = useState(false);

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'denied':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getPermissionBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">Permitido</Badge>;
      case 'denied':
        return <Badge variant="destructive">Negado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    setHasTriedRequest(true);
    try {
      await requestAllPermissions();
    } catch (error) {
      console.error('Permission request failed:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      if (isNative && Capacitor.isNativePlatform()) {
        await (App as any).openSettings();
      } else {
        // Web fallback - show instructions
        alert('Por favor, acesse as configurações do navegador para habilitar as permissões.');
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  };

  const allPermissionsGranted = permissions.location === 'granted';
  const hasPermissionDenied = permissions.location === 'denied' || permissions.camera === 'denied';
  const shouldShowOpenSettings = hasTriedRequest && (hasPermissionDenied || (!allPermissionsGranted && !isRequesting));

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões do Aplicativo</DialogTitle>
          <DialogDescription>
            Para uma melhor experiência, precisamos de algumas permissões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {deviceInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dispositivo</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  {isNative ? deviceInfo.model : 'Navegador Web'} - {deviceInfo.operatingSystem || deviceInfo.platform}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <CardTitle className="text-sm">Localização (GPS)</CardTitle>
                  </div>
                  {getPermissionIcon(permissions.location)}
                </div>
                <CardDescription className="text-xs">
                  Necessário para rastrear treinos e atividades físicas
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {getPermissionBadge(permissions.location)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <CardTitle className="text-sm">Câmera</CardTitle>
                  </div>
                  {getPermissionIcon(permissions.camera)}
                </div>
                <CardDescription className="text-xs">
                  Para compartilhar fotos dos seus treinos
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {getPermissionBadge(permissions.camera)}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            {!allPermissionsGranted && !shouldShowOpenSettings && (
              <Button 
                onClick={handleRequestPermissions}
                disabled={isRequesting}
                className="flex-1"
              >
                {isRequesting ? 'Solicitando...' : 'Permitir Acesso'}
              </Button>
            )}
            
            {shouldShowOpenSettings && (
              <Button 
                onClick={handleOpenSettings}
                variant="outline"
                className="flex-1"
              >
                <Settings className="h-4 w-4 mr-2" />
                Abrir Ajustes
              </Button>
            )}
            
            <Button 
              variant={allPermissionsGranted ? "default" : "outline"}
              onClick={onComplete}
              className={allPermissionsGranted ? "flex-1" : ""}
            >
              {allPermissionsGranted ? 'Continuar' : 'Pular'}
            </Button>
          </div>

          {!isNative && (
            <div className="text-xs text-muted-foreground text-center">
              💡 Para melhor experiência, instale o app no seu dispositivo
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};