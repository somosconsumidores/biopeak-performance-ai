import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    email: string;
    created_at: string;
    raw_user_meta_data: {
      display_name?: string;
    };
  };
  schema: string;
  old_record: null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    console.log("Welcome email webhook triggered:", {
      type: payload.type,
      userId: payload.record.id,
      email: payload.record.email
    });

    // Only process user creation events
    if (payload.type !== "INSERT" || payload.table !== "users") {
      console.log("Skipping non-user creation event");
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, raw_user_meta_data } = payload.record;
    const displayName = raw_user_meta_data?.display_name || email.split('@')[0];

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bem-vindo ao BioPeak</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0;">🎉 Bem-vindo ao BioPeak!</h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin: 10px 0 0 0;">Sua jornada fitness começa aqui</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 20px;">
              <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">Olá, ${displayName}! 👋</h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                É um prazer tê-lo(a) no BioPeak! Agora você tem acesso à plataforma mais avançada para monitoramento e análise de performance esportiva.
              </p>
              
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">🚀 O que você pode fazer agora:</h3>
                <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Conectar seus dispositivos Garmin, Polar ou Strava</li>
                  <li style="margin-bottom: 8px;">Sincronizar automaticamente suas atividades</li>
                  <li style="margin-bottom: 8px;">Receber insights personalizados com IA</li>
                  <li style="margin-bottom: 8px;">Acompanhar métricas avançadas de performance</li>
                  <li>Definir e monitorar seus objetivos fitness</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://grcwlmltlcltmwbhdpky.supabase.co" 
                   style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Começar Agora
                </a>
              </div>
              
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0;">
                  <strong>Precisa de ajuda?</strong> Nossa equipe está aqui para ajudar você a aproveitar ao máximo o BioPeak.
                </p>
                <p style="color: #64748b; font-size: 14px; margin: 0;">
                  📧 Responda este email ou visite nossa central de ajuda
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                © 2025 BioPeak. Transformando dados em performance.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "BioPeak <onboarding@resend.dev>",
      to: [email],
      subject: "🎉 Bem-vindo(a) ao BioPeak - Sua jornada fitness começa aqui!",
      html: emailHtml,
    });

    console.log("Welcome email sent successfully:", {
      emailId: emailResponse.data?.id,
      recipient: email,
      displayName
    });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      message: "Welcome email sent successfully" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in welcome-email function:", error);
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