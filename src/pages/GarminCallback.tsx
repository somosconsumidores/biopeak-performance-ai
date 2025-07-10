import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { parseCallbackParams } from '@/lib/garmin-oauth';

export function GarminCallback() {
  const navigate = useNavigate();
  const { isConnected, handleOAuthCallback } = useGarminAuth();

  useEffect(() => {
    console.log('🔄 GarminCallback component mounted');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Pathname:', window.location.pathname);
    console.log('🔍 Search params:', window.location.search);
    
    // Parse the OAuth callback parameters
    const urlParams = parseCallbackParams(window.location.href);
    console.log('🔍 Parsed callback params:', urlParams);
    console.log('🔍 Code length:', urlParams.code?.length || 0);
    console.log('🔍 State length:', urlParams.state?.length || 0);
    
    if (urlParams.error) {
      console.error('❌ OAuth error received:', urlParams.error);
      navigate('/auth?error=garmin_oauth_failed');
      return;
    }
    
    if (urlParams.code && urlParams.state) {
      console.log('✅ Valid OAuth callback detected, calling handleOAuthCallback');
      console.log('📞 About to call handleOAuthCallback with code:', urlParams.code.substring(0, 8) + '...');
      console.log('📞 About to call handleOAuthCallback with state:', urlParams.state.substring(0, 8) + '...');
      
      try {
        handleOAuthCallback(urlParams.code, urlParams.state);
        console.log('✅ handleOAuthCallback called successfully');
      } catch (error) {
        console.error('❌ Error calling handleOAuthCallback:', error);
      }
    } else {
      console.log('❌ Invalid callback - no code or state');
      console.log('❌ Code present:', !!urlParams.code);
      console.log('❌ State present:', !!urlParams.state);
      navigate('/auth');
    }
  }, [navigate, handleOAuthCallback]);

  // If already connected, redirect to sync page
  useEffect(() => {
    if (isConnected) {
      console.log('✅ Connection successful, redirecting to sync page');
      navigate('/sync');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Processando conexão Garmin...
        </h2>
        <p className="text-muted-foreground">
          Por favor, aguarde enquanto finalizamos a conexão com sua conta Garmin.
        </p>
      </div>
    </div>
  );
}