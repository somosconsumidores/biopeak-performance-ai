import { useSubscription } from '@/hooks/useSubscription';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isSubscribed, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return <Navigate to="/paywall" replace />;
  }

  return <>{children}</>;
};