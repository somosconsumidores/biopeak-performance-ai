import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isNative } = usePlatform();
  const navigate = useNavigate();

  // Native apps: just render children (they have their own Header + MobileBottomBar)
  if (isNative) {
    return <>{children}</>;
  }

  // PWA/Desktop: use Sidebar layout
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/sync')}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar Atividades
            </Button>
          </header>
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
