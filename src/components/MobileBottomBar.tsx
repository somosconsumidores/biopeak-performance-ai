import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, Home, Calendar, Utensils, Dumbbell } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

const MobileBottomBar: React.FC = () => {
  const { isNative } = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on native iOS/Android apps
  if (!isNative) return null;

  // Don't show on auth pages and landing page
  const hideOnRoutes = ['/', '/auth', '/reset-password'];
  if (hideOnRoutes.includes(location.pathname)) return null;

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Início' },
    { path: '/workouts', icon: Dumbbell, label: 'Treinos' },
    { path: '/training-plan', icon: Calendar, label: 'Plano' },
    { path: '/dashboard?section=nutrition-plan', icon: Utensils, label: 'Nutrição' },
    { path: '/insights', icon: Brain, label: 'Insights' }
  ];

  const isActive = (itemPath: string) => {
    const [path, query] = itemPath.split('?');
    if (query) {
      return location.pathname === path && location.search.includes('section=nutrition-plan');
    }
    return location.pathname === path && !location.search.includes('section=nutrition-plan');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
      <div className="flex justify-around items-center py-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 h-12 px-2 ${
                active 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomBar;