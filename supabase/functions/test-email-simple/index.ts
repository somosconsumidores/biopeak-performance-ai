import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: TestEmailRequest = await req.json();
    
    console.log("Testing simple email send to:", email);

    // Test 1: Very simple email
    const simpleEmailResponse = await resend.emails.send({
      from: "BioPeak <noreply@biopeak-ai.com>",
      to: [email],
      subject: "Test Email - BioPeak",
      text: "This is a simple test email from BioPeak. If you receive this, the email configuration is working.",
      html: "<p>This is a simple test email from BioPeak. If you receive this, the email configuration is working.</p>",
    });

    console.log("Simple email test response:", {
      success: !!simpleEmailResponse.data?.id,
      emailId: simpleEmailResponse.data?.id,
      error: simpleEmailResponse.error,
      fullResponse: JSON.stringify(simpleEmailResponse, null, 2)
    });

    // Test 2: Check API key permissions
    const apiKeyTest = await resend.apiKeys.list();
    console.log("API Key test:", {
      success: !apiKeyTest.error,
      error: apiKeyTest.error,
      data: apiKeyTest.data
    });

    // Test 3: Check domain status
    const domainTest = await resend.domains.list();
    console.log("Domain test:", {
      success: !domainTest.error,
      error: domainTest.error,
      domains: domainTest.data
    });

    if (!simpleEmailResponse.data?.id) {
      throw new Error(`Failed to send test email: ${JSON.stringify(simpleEmailResponse.error)}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: simpleEmailResponse.data.id,
      message: "Test email sent successfully",
      apiKeyValid: !apiKeyTest.error,
      domains: domainTest.data
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in test-email-simple function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);