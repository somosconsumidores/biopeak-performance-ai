import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

export interface GarminTokenInfo {
  access_token: string;
  expires_at: string;
  token_secret?: string;
  is_expired: boolean;
  needs_refresh: boolean;
}

export class GarminTokenManager {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getTokenInfo(userId: string): Promise<GarminTokenInfo | null> {
    const { data: tokenData, error } = await this.supabase
      .from('garmin_tokens')
      .select('access_token, expires_at, token_secret')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !tokenData) {
      console.log('[GarminTokenManager] No token found for user:', userId);
      return null;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));

    return {
      access_token: tokenData.access_token,
      expires_at: tokenData.expires_at,
      token_secret: tokenData.token_secret,
      is_expired: timeUntilExpiry <= 0,
      needs_refresh: minutesUntilExpiry < 10 // Refresh if expires in less than 10 minutes
    };
  }

  async refreshTokenIfNeeded(userId: string): Promise<string | null> {
    const tokenInfo = await this.getTokenInfo(userId);
    
    if (!tokenInfo) {
      console.log('[GarminTokenManager] No token info available for user:', userId);
      return null;
    }

    if (!tokenInfo.needs_refresh && !tokenInfo.is_expired) {
      console.log('[GarminTokenManager] Token is still valid, no refresh needed');
      return tokenInfo.access_token;
    }

    if (!tokenInfo.token_secret) {
      console.error('[GarminTokenManager] Cannot refresh token: no refresh token available');
      return null;
    }

    console.log('[GarminTokenManager] Token needs refresh, attempting refresh...');

    try {
      const { data, error } = await this.supabase.functions.invoke('garmin-oauth', {
        body: {
          refresh_token: tokenInfo.token_secret,
          grant_type: 'refresh_token'
        }
      });

      if (error) {
        console.error('[GarminTokenManager] Token refresh failed:', error);
        return null;
      }

      if (data && data.success) {
        console.log('[GarminTokenManager] Token refreshed successfully');
        
        // Wait a moment for the database to be updated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the new token
        const updatedTokenInfo = await this.getTokenInfo(userId);
        return updatedTokenInfo?.access_token || null;
      } else {
        console.error('[GarminTokenManager] Token refresh response invalid:', data);
        return null;
      }
    } catch (refreshError) {
      console.error('[GarminTokenManager] Token refresh exception:', refreshError);
      return null;
    }
  }

  async getValidAccessToken(userId: string): Promise<string | null> {
    console.log('[GarminTokenManager] Getting valid access token for user:', userId);
    
    const tokenInfo = await this.getTokenInfo(userId);
    
    if (!tokenInfo) {
      return null;
    }

    if (tokenInfo.is_expired || tokenInfo.needs_refresh) {
      console.log('[GarminTokenManager] Token expired or needs refresh, attempting refresh');
      return await this.refreshTokenIfNeeded(userId);
    }

    console.log('[GarminTokenManager] Token is valid, returning current token');
    return tokenInfo.access_token;
  }
}