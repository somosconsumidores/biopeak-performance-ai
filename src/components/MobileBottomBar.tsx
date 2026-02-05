import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TrendingUp, Home, Calendar, Dumbbell, MessageCircle } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  isCenter: boolean;
  requiresSubscription?: boolean;
}

const MobileBottomBar: React.FC = () => {
  const { isNative } = usePlatform();
  const { isSubscribed } = useSubscription();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on native iOS/Android apps
  if (!isNative) return null;

  // Don't show on auth pages and landing page
  const hideOnRoutes = ['/', '/auth', '/reset-password'];
  if (hideOnRoutes.includes(location.pathname)) return null;

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: Home, label: 'Início', isCenter: false },
    { path: '/workouts', icon: Dumbbell, label: 'Treinos', isCenter: false },
    { path: '/evolution', icon: TrendingUp, label: 'Evolução', isCenter: true },
    { path: '/training-plan', icon: Calendar, label: 'Plano', isCenter: false },
    { path: '/ai-coach', icon: MessageCircle, label: 'Chat', isCenter: false, requiresSubscription: true },
  ];

  const isActive = (itemPath: string) => {
    return location.pathname === itemPath;
  };

  const handleNavigation = (item: NavItem) => {
    // Check subscription for premium features
    if (item.requiresSubscription && !isSubscribed) {
      toast({
        title: "Recurso Premium",
        description: "O Chat com Coach IA é exclusivo para assinantes.",
      });
      navigate('/paywall2');
      return;
    }
    navigate(item.path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
      <div 
        className="flex justify-around items-end py-2 px-4" 
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          // Central item with special highlight
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item)}
                className="relative -mt-5 flex items-center justify-center focus:outline-none"
              >
                <div className={`
                  w-14 h-14 rounded-full flex items-center justify-center
                  bg-gradient-to-br from-primary to-primary/80
                  shadow-lg shadow-primary/30
                  transition-all duration-200
                  ${active ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-card' : ''}
                `}>
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              </button>
            );
          }
          
          // Regular items
          return (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation(item)}
              className={`flex flex-col items-center justify-center gap-1 h-12 px-2 ${
                active 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomBar;
