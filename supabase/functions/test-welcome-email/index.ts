import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log("Testing welcome email for:", email);

    // Create the webhook payload that would be sent when a user signs up
    const webhookPayload = {
      type: "INSERT",
      table: "users",
      record: {
        id: crypto.randomUUID(),
        email: email,
        created_at: new Date().toISOString(),
        raw_user_meta_data: {
          display_name: email.split('@')[0]
        }
      },
      schema: "auth",
      old_record: null
    };

    // Call the welcome-email function
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabase.functions.invoke("welcome-email", {
      body: webhookPayload
    });

    if (error) {
      console.error("Error calling welcome-email function:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to send welcome email", 
        details: error 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log("Welcome email test completed:", data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Welcome email sent successfully",
      data 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: any) {
    console.error("Error in test-welcome-email function:", error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);