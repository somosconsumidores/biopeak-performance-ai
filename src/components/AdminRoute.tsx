import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Alert, AlertDescription } from './ui/alert';
import { ShieldAlert } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary">Verificando permissões...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Apenas administradores podem acessar esta área.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};