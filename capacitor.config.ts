import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.biopeak',
  appName: 'biopeak-performance-ai',
  webDir: 'dist',
  // Force offline/local mode - NO server configuration
  bundledWebRuntime: false,
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
    BackgroundGeolocation: {
      enableHighAccuracy: true,
      desiredAccuracy: 'HIGH_ACCURACY',
      stationaryRadius: 10,
      distanceFilter: 10,
      interval: 5000,
      fastestInterval: 1000,
      activitiesInterval: 10000,
      maxAge: 10000,
      timeout: 10000,
      notificationTitle: 'BioPeak - Treino Ativo',
      notificationText: 'Rastreamento GPS em andamento',
      enableHeadless: true,
      startOnBoot: false,
      stopOnStillActivity: false,
      saveBatteryOnBackground: true
    },
    ForegroundService: {
      notificationTitle: 'BioPeak Performance',
      notificationText: 'Monitorando sua performance',
      enableBatteryOptimizations: false
    },
    BackgroundMode: {
      title: 'BioPeak está ativo',
      text: 'Rastreando sua performance',
      icon: 'icon',
      color: '3b82f6',
      resume: true,
      hidden: false,
      bigText: false
    },
    CapacitorHealth: {
      syncOnAppStart: true,
      syncInterval: 'hourly'
    },
    PurchasesPlugin: {
      usesStoreKit2IfAvailable: false
    }
  },
  android: {
    allowMixedContent: true,
    usesCleartextTraffic: true,
    webContentsDebuggingEnabled: true,
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.WAKE_LOCK",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE"
    ]
  },
  ios: {
    webSecurity: true,
    allowsLinkPreview: false,
    allowsInlineMediaPlayback: true,
    allowsBackForwardNavigationGestures: true,
    scrollEnabled: true,
    permissions: [
      "NSLocationWhenInUseUsageDescription",
      "NSLocationAlwaysAndWhenInUseUsageDescription", 
      "NSCameraUsageDescription",
      "NSMicrophoneUsageDescription",
      "NSPhotoLibraryUsageDescription",
      "NSHealthShareUsageDescription",
      "NSHealthUpdateUsageDescription"
    ]
  },
};

export default config;