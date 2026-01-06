import { ReactNode } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isNative } = usePlatform();

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
          <header className="h-14 flex items-center border-b border-border px-4 bg-background/95 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger className="mr-4" />
          </header>
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
