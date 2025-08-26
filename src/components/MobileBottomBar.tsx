import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Brain, Home, BarChart, User, Calendar } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileBottomBar: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on mobile devices
  if (!isMobile) return null;

  // Don't show on auth pages and landing page
  const hideOnRoutes = ['/', '/auth', '/reset-password'];
  if (hideOnRoutes.includes(location.pathname)) return null;

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Início' },
    { path: '/workouts', icon: BarChart, label: 'Treinos' },
    { path: '/training-plan', icon: Calendar, label: 'Plano' },
    { path: '/insights', icon: Brain, label: 'Insights' },
    { path: '/profile', icon: User, label: 'Perfil' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 md:hidden">
      <div className="flex justify-around items-center py-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 h-12 px-2 ${
                isActive 
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