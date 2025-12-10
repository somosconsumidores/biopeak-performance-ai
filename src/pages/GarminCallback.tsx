import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGarminAuth } from '@/hooks/useGarminAuth';
import { parseCallbackParams, getPKCEData, storePKCEData } from '@/lib/garmin-oauth';
import { supabase } from '@/integrations/supabase/client';

export function GarminCallback() {
  const navigate = useNavigate();
  const { isConnected, handleOAuthCallback } = useGarminAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      
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
        console.log('✅ Valid OAuth callback detected');
        
        // Try to get PKCE data from localStorage first (web flow)
        let pkceData = getPKCEData();
        console.log('🔍 PKCE from localStorage:', pkceData ? 'found' : 'not found');
        
        // If not found in localStorage, try to fetch from Supabase (native flow)
        if (!pkceData) {
          console.log('🔍 Attempting to fetch PKCE from Supabase (native flow)...');
          
          try {
            // First, get current user
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user?.id) {
              console.log('🔍 Found user, fetching PKCE for user:', user.id);
              
              const { data: pkceFromDb, error: pkceError } = await supabase
                .from('oauth_temp_tokens')
                .select('oauth_token, oauth_token_secret')
                .eq('user_id', user.id)
                .eq('provider', 'garmin_pkce')
                .maybeSingle();
              
              if (pkceError) {
                console.error('❌ Error fetching PKCE from Supabase:', pkceError);
              } else if (pkceFromDb) {
                console.log('✅ PKCE found in Supabase (native flow)');
                pkceData = {
                  codeVerifier: pkceFromDb.oauth_token,
                  state: pkceFromDb.oauth_token_secret
                };
                
                // Store in localStorage for the handleOAuthCallback function
                storePKCEData(pkceData);
                
                // Clean up the temp PKCE data
                await supabase
                  .from('oauth_temp_tokens')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('provider', 'garmin_pkce');
                console.log('🧹 PKCE data cleaned from Supabase');
              } else {
                console.log('⚠️ No PKCE data found in Supabase');
              }
            } else {
              console.log('⚠️ No authenticated user found for PKCE lookup');
            }
          } catch (e) {
            console.error('❌ Error in PKCE Supabase lookup:', e);
          }
        }
        
        if (!pkceData) {
          console.error('❌ No PKCE data found anywhere');
          navigate('/sync?error=pkce_not_found');
          return;
        }
        
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
    };
    
    processCallback();
  }, [navigate, handleOAuthCallback, isProcessing]);

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