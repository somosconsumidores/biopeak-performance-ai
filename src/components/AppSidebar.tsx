import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Dumbbell, 
  TrendingUp, 
  Calendar, 
  Utensils, 
  Lightbulb,
  BarChart3,
  User,
  RefreshCw,
  LogOut,
  Moon,
  Sun,
  Globe
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useToast } from '@/hooks/use-toast';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { isSubscribed } = useSubscription();
  const { toast } = useToast();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      toast({
        title: t('error'),
        description: t('errorSigningOut'),
        variant: 'destructive',
      });
    }
  };

  const mainNavItems = [
    { title: 'Meu Coach IA', path: '/dashboard', icon: Home },
    { title: 'Treinos', path: '/workouts', icon: Dumbbell },
    { title: 'Planos de Treino', path: '/training-plan', icon: Calendar },
    { title: 'Insights', path: '/insights', icon: Lightbulb },
  ];

  const resourceNavItems = [
    { title: 'Painel Estatístico', path: '/premium-stats', icon: BarChart3 },
    { title: 'Perfil', path: '/profile', icon: User },
  ];

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => navigate('/dashboard')}
        >
          <img 
            src="https://grcwlmltlcltmwbhdpky.supabase.co/storage/v1/object/public/Geral/BioPeak%2010124-fundo%20branco.png" 
            alt="BioPeak" 
            className="h-8 w-auto"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'w-full justify-start',
                      isActive(item.path) && 'bg-accent text-accent-foreground font-medium'
                    )}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Minha Evolução - Highlighted */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/evolution')}
                  className={cn(
                    'w-full justify-start my-2',
                    'bg-gradient-to-r from-primary/10 to-primary/5',
                    'border border-primary/20 rounded-lg',
                    'hover:from-primary/20 hover:to-primary/10',
                    'transition-all duration-200',
                    isActive('/evolution') && 'bg-primary/20 border-primary/40 shadow-sm'
                  )}
                >
                  <TrendingUp className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold text-primary">Minha Evolução</span>
                  {!isSubscribed && (
                    <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      PRO
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel>{t('resources')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resourceNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'w-full justify-start',
                      isActive(item.path) && 'bg-accent text-accent-foreground font-medium'
                    )}
                  >
                    <item.icon className="h-4 w-4 mr-3" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Actions */}
        <SidebarGroup>
          <SidebarGroupLabel>{t('actions')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/sync')}
                  className={cn(
                    'w-full justify-start',
                    isActive('/sync') && 'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  <RefreshCw className="h-4 w-4 mr-3" />
                  <span>{t('syncActivities')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{t('theme')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 p-0"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Language Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>{t('language')}</span>
          </div>
          <LanguageSelector />
        </div>

        <SidebarSeparator />

        {/* User Info & Logout */}
        {user && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('logout')}
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
