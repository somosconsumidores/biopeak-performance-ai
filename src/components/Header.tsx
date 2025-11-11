import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';
import AchievementBadge from '@/components/AchievementBadge';
// Logo imports
const BASE = import.meta.env.BASE_URL || '';
const bioPeakLogoDark = `${BASE}lovable-uploads/4f1bd6d1-3d85-4200-84b8-b6edda665af2.png`;
const bioPeakLogoLight = `${BASE}lovable-uploads/3dba3af8-cea5-4fda-8621-8da7e87686be.png`;

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isIOS, isNative } = usePlatform();

  // Get current logo based on theme
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };
  
  const currentLogo = getEffectiveTheme() === 'light' ? bioPeakLogoLight : bioPeakLogoDark;

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
        toast({
          title: 'Erro ao sair',
          description: 'Ocorreu um erro ao fazer logout. Tente novamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Logout realizado',
          description: 'Você saiu da sua conta com sucesso.',
        });
      }
    } catch (error) {
      console.error('Unexpected logout error:', error);
      toast({
        title: 'Erro ao sair',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Build navigation array conditionally
  const navigation = [
    { name: t('dashboard'), href: '/dashboard' },
    { name: 'Painel Estatístico', href: '/premium-stats' },
    { name: t('workouts'), href: '/workouts' },
    { name: t('insights'), href: '/insights' },
    { name: 'Calendário de Provas', href: '/training-plan' },
    { name: 'Feedbacks de Sono', href: '/sleep-feedbacks' },
    { name: t('profile'), href: '/profile' },
    // Show AI Coach on all native platforms (iOS and Android)
    ...(isNative ? [{ name: 'BioPeak AI Coach', href: '/training' }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-0 border-b border-glass-border">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={currentLogo} alt="BioPeak" className="h-8 w-8 sm:h-10 sm:w-10" />
          </Link>

          {/* Desktop Navigation */}
          {user ? (
            <>
              <nav className="hidden md:flex items-center space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="text-foreground/80 hover:text-primary transition-colors duration-200 font-medium"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
                <LanguageSelector />
                <ThemeToggle />
                  <AchievementBadge 
                    onClick={() => {}} 
                  />
                <Button variant="outline" className="glass-card border-glass-border text-sm" asChild>
                  <Link to="/sync">{t('syncActivities')}</Link>
                </Button>
                <Button onClick={handleSignOut} variant="outline" className="glass-card border-glass-border text-sm">
                  {t('logout')}
                </Button>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center space-x-4">
              <LanguageSelector />
              <ThemeToggle />
              <Button variant="outline" className="glass-card border-glass-border" asChild>
                <Link to="/auth">{t('login')}</Link>
              </Button>
              <Button className="btn-primary" asChild>
                <Link to="/auth">{t('getStarted')}</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <LanguageSelector />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 glass-card mt-2 border-glass-border">
              {user ? (
                <>
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="block px-3 py-3 text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 touch-manipulation"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <Link
                    to="/sync"
                    className="block px-3 py-3 text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 touch-manipulation"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('syncActivities')}
                  </Link>
                  {!isSubscribed && (
                    <Link
                      to="/paywall2"
                      className="block px-3 py-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-200 touch-manipulation border-t border-glass-border mt-2 pt-4"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      BioPeak Plano Pro
                    </Link>
                  )}
                  <div className="pt-4 pb-2">
                    <Button 
                      onClick={handleSignOut} 
                      variant="outline" 
                      className="w-full glass-card border-glass-border h-12 text-sm touch-manipulation"
                    >
                      {t('logout')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="pt-4 pb-2 space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full glass-card border-glass-border h-12 text-sm touch-manipulation" 
                    asChild
                  >
                    <Link to="/auth">{t('login')}</Link>
                  </Button>
                  <Button className="w-full btn-primary h-12 text-sm touch-manipulation" asChild>
                    <Link to="/auth">{t('getStarted')}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};