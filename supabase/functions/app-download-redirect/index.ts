import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.biopeakai.performance&pcampaignid=welcome_email";
const IOS_STORE_URL = "https://apps.apple.com/us/app/biopeak-ai/id6752911184?ct=cta&mt=welcome_email";
const FALLBACK_URL = "https://biopeak-ai.com/download";

const handler = async (req: Request): Promise<Response> => {
  const userAgent = req.headers.get("user-agent") || "";
  const ua = userAgent.toLowerCase();

  let redirectUrl = FALLBACK_URL;

  // Detect iOS devices
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || ua.includes("mac os")) {
    redirectUrl = IOS_STORE_URL;
  }
  // Detect Android devices
  else if (ua.includes("android")) {
    redirectUrl = ANDROID_STORE_URL;
  }

  console.log("App download redirect:", {
    userAgent: userAgent.substring(0, 100),
    detectedPlatform: redirectUrl === IOS_STORE_URL ? "iOS" : redirectUrl === ANDROID_STORE_URL ? "Android" : "fallback",
    redirectUrl
  });

  return new Response(null, {
    status: 302,
    headers: {
      "Location": redirectUrl,
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
};

serve(handler);
