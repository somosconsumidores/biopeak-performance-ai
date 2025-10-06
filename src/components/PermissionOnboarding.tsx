import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { MapPin } from 'lucide-react';
import { useNativePermissions } from '../hooks/useNativePermissions';

interface PermissionOnboardingProps {
  open: boolean;
  onComplete: () => void;
}

export const PermissionOnboarding: React.FC<PermissionOnboardingProps> = ({
  open,
  onComplete
}) => {
  const { permissions, requestAllPermissions } = useNativePermissions();
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasTriedRequest, setHasTriedRequest] = useState(false);

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    setHasTriedRequest(true);
    try {
      await requestAllPermissions();
      // If location is granted, complete onboarding
      if (permissions.location === 'granted') {
        onComplete();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContinue = () => {
    // If user already tried and permissions were denied, allow them to continue without permissions
    if (hasTriedRequest && permissions.location !== 'granted') {
      onComplete();
    } else {
      // First attempt - request permissions
      handleRequestPermissions();
    }
  };

  const allPermissionsGranted = permissions.location === 'granted';
  const showContinueWithoutPermissions = hasTriedRequest && !allPermissionsGranted;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onComplete()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bem-vindo ao BioPeak</DialogTitle>
          <DialogDescription>
            Para rastrear seus treinos, precisamos acessar sua localização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Permissão de Localização</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Usamos sua localização apenas durante os treinos para:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside pl-2">
                <li>Rastrear distância e percurso</li>
                <li>Calcular velocidade e ritmo</li>
                <li>Registrar altitude e elevação</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Seus dados são privados e nunca compartilhados.
              </p>
            </CardContent>
          </Card>

          <Button 
            onClick={handleContinue}
            disabled={isRequesting}
            className="w-full"
            size="lg"
          >
            {isRequesting ? 'Solicitando...' : showContinueWithoutPermissions ? 'Continuar sem Permissões' : 'Continuar'}
          </Button>

          {hasTriedRequest && !allPermissionsGranted && (
            <p className="text-xs text-center text-muted-foreground">
              Você pode fechar e usar o app com funcionalidade limitada
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};