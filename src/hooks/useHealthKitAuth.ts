import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { HealthKit } from '../lib/healthkit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface HealthKitPermission {
  read: boolean;
  write: boolean;
}

interface HealthKitPermissions {
  workouts: HealthKitPermission;
  heartRate: HealthKitPermission;
  activeEnergy: HealthKitPermission;
  distanceWalkingRunning: HealthKitPermission;
  steps: HealthKitPermission;
}

export const useHealthKitAuth = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permissions, setPermissions] = useState<HealthKitPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConnectedDevice, setHasConnectedDevice] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkHealthKitSupport();
    checkConnectionStatus();
  }, []);

  const checkHealthKitSupport = async () => {
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const deviceInfo = await Device.getInfo();
        setIsSupported(deviceInfo.platform === 'ios');
      }
    } catch (error) {
      console.error('[useHealthKitAuth] Error checking HealthKit support:', error);
      setIsSupported(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('healthkit_sync_status')
        .select('permissions_granted')
        .eq('user_id', session.user.id)
        .single();

      setHasConnectedDevice(data?.permissions_granted || false);
    } catch (error) {
      console.error('[useHealthKitAuth] Error checking connection status:', error);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      if (!isSupported) {
        toast({
          title: "Não suportado",
          description: "HealthKit não está disponível neste dispositivo.",
          variant: "destructive",
        });
        return false;
      }

      // Request HealthKit permissions
      const permissions = await HealthKit.requestAuthorization({
        read: [
          'steps',
          'distance',
          'calories',
          'activity',
          'heart_rate'
        ],
        write: []
      });

      if (!permissions.granted) {
        toast({
          title: "Permissões negadas",
          description: "É necessário permitir acesso aos dados de saúde.",
          variant: "destructive",
        });
        return false;
      }

      // Check individual permissions
      const healthPermissions: HealthKitPermissions = {
        workouts: { read: true, write: false },
        heartRate: { read: permissions.granted, write: false },
        activeEnergy: { read: permissions.granted, write: false },
        distanceWalkingRunning: { read: permissions.granted, write: false },
        steps: { read: permissions.granted, write: false }
      };

      setPermissions(healthPermissions);

      // Update sync status in database
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('healthkit_sync_status')
          .upsert({
            user_id: session.user.id,
            permissions_granted: true,
            sync_status: 'ready'
          });

        setHasConnectedDevice(true);
      }

      toast({
        title: "Permissões concedidas",
        description: "Acesso ao HealthKit configurado com sucesso.",
      });

      return true;
    } catch (error) {
      console.error('[useHealthKitAuth] Error requesting permissions:', error);
      toast({
        title: "Erro de permissão",
        description: "Falha ao solicitar permissões do HealthKit.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      // Update sync status to disconnected
      await supabase
        .from('healthkit_sync_status')
        .update({
          permissions_granted: false,
          sync_status: 'disconnected'
        })
        .eq('user_id', session.user.id);

      setPermissions(null);
      setHasConnectedDevice(false);

      toast({
        title: "HealthKit desconectado",
        description: "Conexão com HealthKit foi removida.",
      });

      return true;
    } catch (error) {
      console.error('[useHealthKitAuth] Error disconnecting:', error);
      toast({
        title: "Erro ao desconectar",
        description: "Falha ao desconectar do HealthKit.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    permissions,
    hasConnectedDevice,
    isLoading,
    requestPermissions,
    disconnect,
    checkConnectionStatus
  };
};