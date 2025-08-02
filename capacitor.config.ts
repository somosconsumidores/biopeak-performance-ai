import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.biopeak',
  appName: 'biopeak-performance-ai',
  webDir: 'dist',
  server: {
    url: 'https://2de71c28-ed78-4dcd-8f5f-290d2b70bd62.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0f172a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#3b82f6",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {
      enableHighAccuracy: true,
      maximumAge: 3600000,
      timeout: 10000,
    },
    Camera: {
      allowEditing: true,
      quality: 90,
      resultType: "uri",
      source: "prompt",
      saveToGallery: false,
    },
  },
  android: {
    allowMixedContent: true,
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE"
    ]
  },
  ios: {
    permissions: [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription", 
      "NSCameraUsageDescription",
      "NSMicrophoneUsageDescription",
      "NSPhotoLibraryUsageDescription",
    ]
  },
};

export default config;