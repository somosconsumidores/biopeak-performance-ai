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
    
    // Parse the OAuth callback parameters
    const urlParams = parseCallbackParams(window.location.href);
    console.log('🔍 Callback params:', urlParams);
    
    if (urlParams.error) {
      console.error('❌ OAuth error received:', urlParams.error);
      navigate('/auth?error=garmin_oauth_failed');
      return;
    }
    
    if (urlParams.code && urlParams.state) {
      console.log('✅ Valid OAuth callback detected, calling handleOAuthCallback');
      handleOAuthCallback(urlParams.code, urlParams.state);
    } else {
      console.log('❌ Invalid callback - no code or state');
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