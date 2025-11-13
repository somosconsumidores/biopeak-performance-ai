import { useState, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Navigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isSubscribed, loading } = useSubscription();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // ⭐ NOVO: Timeout de 5 segundos
  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
    setShowTimeoutWarning(false);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando assinatura...</p>
          
          {/* ⭐ NOVO: Mostrar aviso após 5s */}
          {showTimeoutWarning && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Verificação mais lenta que o esperado
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Isso pode indicar problemas de conexão. O app está tentando carregar seus dados em cache...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return <Navigate to="/paywall2" replace />;
  }

  return <>{children}</>;
};