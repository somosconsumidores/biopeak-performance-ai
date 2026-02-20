import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error logging to help diagnose native issues
window.addEventListener('error', (e) => {
  console.error('GLOBAL ERROR:', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED PROMISE REJECTION:', e.reason);
  // Prevent unhandled rejections from crashing the app
  e.preventDefault();
});

// Eager HealthKit initialization for native iOS
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  console.log('🏥 Eager loading HealthKit on iOS...');
  import('./lib/healthkit').then(({ HealthKit }) => {
    console.log('🏥 HealthKit wrapper loaded for iOS native platform');
    // Force initialization by accessing a method
    HealthKit.constructor.name; // This ensures the class is instantiated
  }).catch(error => {
    console.error('🏥 Failed to load HealthKit wrapper:', error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
