import { supabase } from "@/integrations/supabase/client";

export interface PolarOAuthConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface PolarAuthState {
  state: string;
  redirectUri: string;
  codeVerifier?: string;
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
      redirect_uri: config.redirectUri, // Always required for consistency
      scope: config.scope || 'accesslink.read_all', // Mandatory scope for Accesslink
      ...(config.state && { state: config.state }),
    });

    return `${this.AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  }

  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string // Now required for consistency with authorization
  ): Promise<PolarTokenResponse> {
    if (!code || !clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing required parameters for token exchange');
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri, // Must be identical to authorization request
    });

    console.log('Polar token exchange request:', {
      endpoint: this.TOKEN_ENDPOINT,
      redirectUri,
      codeLength: code.length
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
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: 'parse_error', description: errorText };
      }
      
      console.error('Polar token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // Handle specific Polar error codes from documentation
      const errorMessage = this.getPolarErrorMessage(errorData.error);
      throw new Error(`Token exchange failed: ${errorMessage} (${errorData.error || response.statusText})`);
    }

    const tokenData = await response.json();
    console.log('Polar token exchange successful:', {
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      userId: tokenData.x_user_id
    });

    return tokenData;
  }

  private static getPolarErrorMessage(errorCode: string): string {
    const errorMessages = {
      'invalid_request': 'The request is missing a required parameter or is malformed',
      'invalid_client': 'Client authentication failed',
      'invalid_grant': 'The authorization code is invalid, expired, or revoked',
      'unauthorized_client': 'The client is not authorized to use this grant type',
      'unsupported_grant_type': 'The grant type is not supported',
      'invalid_scope': 'The requested scope is invalid or malformed'
    };
    
    return errorMessages[errorCode] || 'Unknown error occurred';
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
    // Use hash router format for Polar callback
    return `${baseUrl}/#/polar-callback`;
  }

  static validateAuthState(receivedState: string, storedState: string): boolean {
    if (!receivedState || !storedState) {
      console.error('Missing state parameters for validation');
      return false;
    }
    
    const isValid = receivedState === storedState;
    console.log('State validation:', { receivedState, storedState, isValid });
    return isValid;
  }

  static async storeAuthState(state: PolarAuthState): Promise<void> {
    try {
      sessionStorage.setItem('polar_auth_state', JSON.stringify(state));
      console.log('Stored Polar auth state:', { state: state.state, redirectUri: state.redirectUri });
    } catch (error) {
      console.error('Failed to store auth state:', error);
      throw new Error('Failed to store authentication state');
    }
  }

  static getStoredAuthState(): PolarAuthState | null {
    try {
      const stored = sessionStorage.getItem('polar_auth_state');
      if (!stored) return null;
      
      const state = JSON.parse(stored);
      console.log('Retrieved Polar auth state:', { state: state.state, redirectUri: state.redirectUri });
      return state;
    } catch (error) {
      console.error('Failed to retrieve auth state:', error);
      return null;
    }
  }

  static clearAuthState(): void {
    try {
      sessionStorage.removeItem('polar_auth_state');
      console.log('Cleared Polar auth state');
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }
  }
}