import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'ios' | 'android';

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>('web');
  const [isNative, setIsNative] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const currentPlatform = Capacitor.getPlatform() as Platform;
    const nativePlatform = Capacitor.isNativePlatform();
    
    setPlatform(currentPlatform);
    setIsNative(nativePlatform);
    setIsIOS(currentPlatform === 'ios');
    setIsAndroid(currentPlatform === 'android');
  }, []);

  return {
    platform,
    isNative,
    isIOS,
    isAndroid,
    isWeb: platform === 'web'
  };
}