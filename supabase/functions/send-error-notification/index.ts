import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorNotificationRequest {
  functionName: string;
  errorMessage: string;
  errorStack?: string;
  userId?: string;
  requestData?: any;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      functionName,
      errorMessage,
      errorStack,
      userId,
      requestData,
      timestamp,
      severity
    }: ErrorNotificationRequest = await req.json();

    const severityEmoji = {
      low: "🟡",
      medium: "🟠", 
      high: "🔴",
      critical: "🚨"
    };

    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #dc3545; margin: 0;">
              ${severityEmoji[severity]} Erro em Edge Function - BioPeak
            </h1>
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
            <h2 style="color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">
              Detalhes do Erro
            </h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6c757d; width: 150px;">Função:</td>
                <td style="padding: 8px; color: #495057;"><code>${functionName}</code></td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6c757d;">Severidade:</td>
                <td style="padding: 8px; color: #495057;">
                  <span style="background-color: ${severity === 'critical' ? '#dc3545' : severity === 'high' ? '#fd7e14' : severity === 'medium' ? '#ffc107' : '#28a745'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${severity.toUpperCase()}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6c757d;">Timestamp:</td>
                <td style="padding: 8px; color: #495057;">${new Date(timestamp).toLocaleString('pt-BR')}</td>
              </tr>
              ${userId ? `
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #6c757d;">Usuário:</td>
                <td style="padding: 8px; color: #495057;"><code>${userId}</code></td>
              </tr>
              ` : ''}
            </table>

            <h3 style="color: #495057; margin-top: 20px;">Mensagem de Erro:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #dc3545;">
              <code style="color: #dc3545; font-weight: bold;">${errorMessage}</code>
            </div>

            ${errorStack ? `
            <h3 style="color: #495057; margin-top: 20px;">Stack Trace:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto;">
              <pre style="margin: 0; font-size: 12px; color: #495057; white-space: pre-wrap;">${errorStack}</pre>
            </div>
            ` : ''}

            ${requestData ? `
            <h3 style="color: #495057; margin-top: 20px;">Dados da Requisição:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto;">
              <pre style="margin: 0; font-size: 12px; color: #495057; white-space: pre-wrap;">${JSON.stringify(requestData, null, 2)}</pre>
            </div>
            ` : ''}
          </div>

          <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Este email foi gerado automaticamente pelo sistema de monitoramento BioPeak.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "BioPeak Alerts <noreply@bioapeak.com>",
      to: ["sandro.alves.leao@gmail.com"],
      subject: `${severityEmoji[severity]} [${severity.toUpperCase()}] Erro na função ${functionName} - BioPeak`,
      html: emailHtml,
    });

    console.log("Error notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-error-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);