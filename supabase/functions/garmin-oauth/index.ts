import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GARMIN_TOKEN_URL = "https://connectapi.garmin.com/di-oauth2-service/oauth/token";

interface TokenRequest {
  grant_type: string;
  client_id: string;
  client_secret: string;
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  refresh_token?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  jti: string;
  refresh_token_expires_in: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const garminClientIdRaw = Deno.env.get("GARMIN_CLIENT_ID");
  const garminClientSecret = Deno.env.get("GARMIN_CLIENT_SECRET");

  const garminClientId = garminClientIdRaw?.replace(/^\+/, "") || "";

  if (!garminClientId || !garminClientSecret) {
    return new Response("Missing Garmin credentials", { status: 500 });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ client_id: garminClientId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, codeVerifier, redirectUri } = body;

    if (!code || !codeVerifier || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, codeVerifier, redirectUri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenRequestData: TokenRequest = {
      grant_type: "authorization_code",
      client_id: garminClientId,
      client_secret: garminClientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    };

    const formData = new URLSearchParams();
    Object.entries(tokenRequestData).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    console.log("Sending request to Garmin with:", tokenRequestData);

    const response = await fetch(GARMIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Garmin API error:", errorText);
      return new Response(JSON.stringify({ error: "Garmin API error", detail: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenResponse: TokenResponse = await response.json();

    return new Response(JSON.stringify(tokenResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});