import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const ManualTokenRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const refreshToken = async () => {
    setIsRefreshing(true);
    try {
      console.log('[ManualTokenRefresh] Starting token refresh...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Get current tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('garmin_tokens')
        .select('refresh_token, token_secret')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('No active tokens found');
      }

      // Get refresh token (prefer refresh_token column, fallback to token_secret)
      let refreshTokenValue;
      if (tokenData.refresh_token) {
        // Decode base64 and extract refresh token
        try {
          const decodedData = JSON.parse(atob(tokenData.refresh_token));
          refreshTokenValue = decodedData.refreshTokenValue;
        } catch {
          refreshTokenValue = tokenData.refresh_token;
        }
      } else if (tokenData.token_secret) {
        try {
          const secretData = JSON.parse(tokenData.token_secret);
          refreshTokenValue = secretData.refreshTokenValue;
        } catch (error) {
          throw new Error('Could not parse refresh token from token_secret');
        }
      } else {
        throw new Error('No refresh token available');
      }

      console.log('[ManualTokenRefresh] Found refresh token, calling garmin-oauth...');

      // Call garmin-oauth function to refresh token
      const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: refreshTokenValue,
          grant_type: 'refresh_token'
        }
      });

      if (refreshError) {
        console.error('[ManualTokenRefresh] Error calling garmin-oauth:', refreshError);
        throw refreshError;
      }

      console.log('[ManualTokenRefresh] Refresh result:', refreshResult);

      if (refreshResult.success) {
        toast({
          title: "Token Renovado!",
          description: "O token Garmin foi renovado com sucesso.",
        });
      } else {
        throw new Error(refreshResult.error || 'Unknown error');
      }

    } catch (error) {
      console.error('[ManualTokenRefresh] Error:', error);
      toast({
        title: "Erro na Renovação",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold mb-2">Renovação Manual do Token</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Use este botão para renovar manualmente o token Garmin se estiver expirado.
      </p>
      <Button 
        onClick={refreshToken} 
        disabled={isRefreshing}
        variant="outline"
      >
        {isRefreshing ? 'Renovando...' : 'Renovar Token'}
      </Button>
    </div>
  );
};