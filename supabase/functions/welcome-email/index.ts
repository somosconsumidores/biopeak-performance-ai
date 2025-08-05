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
    
    console.log("Welcome email webhook triggered v1.1:", {
      type: payload.type,
      userId: payload.record.id,
      email: payload.record.email,
      timestamp: new Date().toISOString()
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
            <div style="background-color: #0ea5e9; padding: 20px; text-align: center;">
              <img src="https://static.wixstatic.com/media/a025ad_8cbd13ffdb864246be31faddecf48b30~mv2.png" alt="BioPeak - Bem-vindo" style="display: block; max-width: 300px; width: 300px; height: auto; margin: 0 auto; border-radius: 8px;">
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 20px;">
              <h2 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">👋 Olá, atleta!</h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Parabéns por dar o primeiro passo rumo a uma nova era da sua performance esportiva.<br>
                Você agora faz parte do BioPeak, o app que transforma seus dados de treino em inteligência real para evolução física, técnica e estratégica.
              </p>
              
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 15px 0;">🚀 O que você pode esperar:</h3>
                <ul style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">✅ Conexão com seus dispositivos (Garmin, Polar, Strava e outros mais em desenvolvimento)</li>
                  <li style="margin-bottom: 8px;">✅ Recomendações inteligentes com base em IA</li>
                  <li style="margin-bottom: 8px;">✅ Previsões de performance, análise de fadiga e eficiência</li>
                  <li style="margin-bottom: 8px;">✅ Insights diários sobre sono, esforço e recuperação</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://minify-url.com/welcome-email" 
                   style="display: inline-block; background-color: #0ea5e9; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  🔗 Conecte seu dispositivo agora e comece a evoluir
                </a>
              </div>

              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 20px 0; text-align: center;">
                Se preferir, use o BioPeak Ai Coach e registre suas atividades usando a solução nativa de controle de atividade (que está em desenvolvimento)
              </p>
              
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0;">
                  <strong>💬 Precisa de ajuda ou quer dar sugestões?</strong>
                </p>
                <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">
                  Nosso time está a postos. Responda este e-mail ou chame no Instagram @biopeak.ai
                </p>
                <p style="color: #64748b; font-size: 14px; margin: 0;">
                  Amamos ouvir nossos usuários. 💙
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
      from: "BioPeak <noreply@biopeak-ai.com>",
      to: [email],
      subject: "🎉 Bem-vindo(a) ao BioPeak - Sua jornada fitness começa aqui!",
      html: emailHtml,
    });

    console.log("Resend API response detailed:", {
      success: !!emailResponse.data?.id,
      emailId: emailResponse.data?.id,
      error: emailResponse.error,
      data: emailResponse.data,
      fullResponse: JSON.stringify(emailResponse, null, 2),
      timestamp: new Date().toISOString(),
      fromEmail: "BioPeak <noreply@biopeak-ai.com>",
      toEmail: email
    });

    // Validate that the email was actually sent
    if (!emailResponse.data?.id) {
      console.error("EMAIL SEND FAILED:", {
        error: emailResponse.error,
        data: emailResponse.data,
        fullResponse: emailResponse
      });
      throw new Error(`Failed to send email: ${JSON.stringify(emailResponse.error) || 'No email ID returned from Resend'}`);
    }

    console.log("Welcome email sent successfully:", {
      emailId: emailResponse.data.id,
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