import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size
    rollupOptions: {
      external: ['jspdf'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-slot'],
        },
        globals: {
          jspdf: 'jspdf',
        },
      },
      // Prevent aggressive tree-shaking of Capacitor native code
      treeshake: {
        moduleSideEffects: (id) => {
          // Preserve all Capacitor modules and hooks that use them
          return id.includes('@capacitor') || 
                 id.includes('useStravaAuthNative') ||
                 id.includes('StravaConnectionStatus');
        },
      },
    },
  },
  define: {
    // Remove development-only code in production
    __DEV__: mode === 'development',
  },
}));
