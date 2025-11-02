// Debug helper - only logs in development mode
const isDev = import.meta.env.DEV;

export const debugLog = (message: string, data?: any) => {
  if (isDev) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

export const debugError = (message: string, error?: any) => {
  if (isDev) {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
};

export const debugWarn = (message: string, data?: any) => {
  if (isDev) {
    if (data) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }
};

// GPS Hybrid System Debug Logger
export const debugGPSHybrid = {
  switchToNative: (baseDistance: number) => {
    if (isDev) {
      console.log(`🔄 [GPS HYBRID] Switching to native GPS | Base distance: ${baseDistance.toFixed(1)}m`);
    }
  },
  
  nativeUpdate: (distance: number, totalDistance: number, accuracy: number) => {
    if (isDev) {
      console.log(`📍 [GPS HYBRID Native] +${distance.toFixed(1)}m → Total: ${totalDistance.toFixed(1)}m (±${accuracy.toFixed(1)}m)`);
    }
  },
  
  syncToWebView: (baseDistance: number, nativeDistance: number, totalDistance: number) => {
    if (isDev) {
      console.log(`✅ [GPS HYBRID] Synced: ${totalDistance.toFixed(1)}m = ${baseDistance.toFixed(1)}m (base) + ${nativeDistance.toFixed(1)}m (native)`);
    }
  },
  
  visibilityChange: (visible: boolean) => {
    if (isDev) {
      console.log(`📱 [GPS HYBRID] App ${visible ? 'foreground' : 'background'}`);
    }
  },
  
  error: (context: string, error: any) => {
    if (isDev) {
      console.error(`❌ [GPS HYBRID] ${context}:`, error);
    }
  }
};
