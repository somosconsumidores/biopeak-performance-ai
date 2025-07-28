import { supabase } from "@/integrations/supabase/client";

export interface PolarOAuthConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface PolarTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  x_user_id: number;
}

export class PolarOAuth {
  private static readonly AUTHORIZATION_ENDPOINT = 'https://flow.polar.com/oauth2/authorization';
  private static readonly TOKEN_ENDPOINT = 'https://polarremote.com/v2/oauth2/token';
  
  static generateAuthorizationUrl(config: PolarOAuthConfig): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      ...(config.redirectUri && { redirect_uri: config.redirectUri }),
      ...(config.scope && { scope: config.scope }),
      ...(config.state && { state: config.state }),
    });

    return `${this.AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri?: string
  ): Promise<PolarTokenResponse> {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      ...(redirectUri && { redirect_uri: redirectUri }),
    });

    const response = await fetch(this.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json;charset=UTF-8',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`);
    }

    return response.json();
  }

  static async storePolarTokens(
    userId: string,
    tokenData: PolarTokenResponse
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    const { error } = await supabase
      .from('polar_tokens')
      .insert({
        user_id: userId,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        expires_at: expiresAt.toISOString(),
        x_user_id: tokenData.x_user_id,
        polar_user_id: tokenData.x_user_id.toString(),
        is_active: true,
      });

    if (error) {
      throw new Error(`Failed to store Polar tokens: ${error.message}`);
    }
  }

  static getCallbackUrl(): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/polar-callback`;
  }
}