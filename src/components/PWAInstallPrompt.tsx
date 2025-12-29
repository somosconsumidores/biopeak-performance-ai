import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
  const { isNative } = usePlatform();
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Don't show on landing page
  const isLandingPage = location.pathname === '/landingpage';

  useEffect(() => {
    // Check if device is iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    console.log('Fechando prompt de instalação');
    setShowPrompt(false);
    // Store dismissal in localStorage to avoid showing again soon
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Don't show if recently dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  // For iOS devices, show prompt after a delay if not recently dismissed
  useEffect(() => {
    if (isIOS) {
      const dismissed = localStorage.getItem('pwa-prompt-dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
        if (hoursSinceDismissed < 24) return;
      }
      
      // Show iOS prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isIOS]);

  // Don't show on native platforms or if prompt was dismissed
  if (isNative || !showPrompt || isLandingPage) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
      <div className="glass-card border-2 border-primary/20 bg-gradient-to-br from-background/95 via-background/90 to-primary/5 backdrop-blur-xl shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                {isIOS ? '📱 Instalar BioPeak' : '🚀 Instalar Aplicativo'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {isIOS 
                  ? 'Acesse rapidamente seus dados de performance. Toque no botão compartilhar ↗️ e selecione "Adicionar à Tela de Início"'
                  : 'Experiência completa, notificações instantâneas e acesso offline aos seus dados de performance'
                }
              </p>
              
              <div className="flex flex-col gap-3">
                {!isIOS && (
                  <Button
                    onClick={handleInstall}
                    className="w-full h-12 bg-gradient-to-r from-primary via-primary-glow to-primary text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Agora - É Grátis!
                  </Button>
                )}
                
                {/* Botão Fechar mais visível */}
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  className="w-full h-10 border-muted-foreground/20 text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Fechar
                </Button>
                
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    ⚡ Acesso rápido
                  </span>
                  <span className="flex items-center gap-1">
                    📊 Dados offline
                  </span>
                  <span className="flex items-center gap-1">
                    🔔 Notificações
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-muted/50 transition-colors touch-manipulation"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
