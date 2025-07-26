import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TokenRefreshTestButton = () => {
  const [isTesting, setIsTesting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleTestTokenRefresh = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    
    try {
      console.log('[TokenRefreshTest] Starting test for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('test-token-refresh', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('[TokenRefreshTest] Error:', error);
        toast({
          title: "Erro no teste",
          description: error.message || "Falha ao executar teste",
          variant: "destructive"
        });
        return;
      }

      console.log('[TokenRefreshTest] Success:', data);
      toast({
        title: "Teste iniciado!",
        description: "Token configurado para expirar em 2 minutos. Monitore os logs do console para ver a renovação automática.",
        variant: "default"
      });

    } catch (error) {
      console.error('[TokenRefreshTest] Unexpected error:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado durante o teste",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!user || user.id !== 'fa155754-46c5-4f12-99e2-54a9673ff74f') {
    return null; // Only show for test user
  }

  return (
    <div className="p-4 border border-orange-500 bg-orange-50 dark:bg-orange-950 rounded-lg">
      <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">
        🧪 Teste de Renovação de Token
      </h3>
      <p className="text-xs text-orange-600 dark:text-orange-400 mb-3">
        Este botão força o token a expirar em 2 minutos para testar a renovação automática.
      </p>
      <Button
        onClick={handleTestTokenRefresh}
        disabled={isTesting}
        variant="outline"
        size="sm"
        className="text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-300 dark:border-orange-600 dark:hover:bg-orange-900"
      >
        {isTesting ? 'Configurando teste...' : 'Testar Renovação Automática'}
      </Button>
      <p className="text-xs text-orange-500 dark:text-orange-500 mt-2">
        ⚠️ Abra o console do navegador para ver os logs detalhados
      </p>
    </div>
  );
};