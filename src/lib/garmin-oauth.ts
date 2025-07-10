// PKCE utility functions for Garmin OAuth2 flow

// Generate cryptographically secure random string
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

// Generate SHA256 hash and base64url encode
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate PKCE parameters
export async function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  
  return {
    codeVerifier,
    codeChallenge
  };
}

// Generate state parameter
export function generateState(): string {
  return generateRandomString(43);
}

// Build Garmin authorization URL
export function buildGarminAuthURL(
  clientId: string, 
  redirectUri: string, 
  codeChallenge: string, 
  state: string
): string {
  // Remove any leading '+' from client ID
  const cleanClientId = clientId.replace(/^\+/, '');
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cleanClientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state
  });
  
  return `https://connect.garmin.com/oauth2Confirm?${params.toString()}`;
}

// Parse callback URL parameters
export function parseCallbackParams(url: string) {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const error = urlObj.searchParams.get('error');
  
  return { code, state, error };
}

// Token storage utilities
const TOKEN_STORAGE_KEY = 'garmin_tokens';
const PKCE_STORAGE_KEY = 'garmin_pkce';

export interface GarminTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expires_at: number;
  scope: string;
}

export function storeTokens(tokens: Omit<GarminTokens, 'expires_at'>): void {
  const tokensWithExpiry: GarminTokens = {
    ...tokens,
    expires_at: Date.now() + (tokens.expires_in * 1000) - 600000 // Subtract 10 minutes for safety
  };
  
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokensWithExpiry));
}

export function getStoredTokens(): GarminTokens | null {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(PKCE_STORAGE_KEY);
}

export function storePKCEData(data: { codeVerifier: string; state: string }): void {
  localStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(data));
}

export function getPKCEData(): { codeVerifier: string; state: string } | null {
  const stored = localStorage.getItem(PKCE_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function isTokenExpired(tokens: GarminTokens): boolean {
  return Date.now() >= tokens.expires_at;
}