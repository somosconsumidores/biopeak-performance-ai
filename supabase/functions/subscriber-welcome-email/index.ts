import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriberWelcomePayload {
  user_id?: string;
  email: string;
  subscription_tier?: string | null;
  subscription_end?: string | null; // ISO string
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: SubscriberWelcomePayload = await req.json();

    if (!payload?.email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, user_id, subscription_tier, subscription_end } = payload;

    const endDateStr = (() => {
      try {
        return subscription_end ? new Date(subscription_end).toLocaleDateString("pt-BR") : null;
      } catch (_) {
        return subscription_end || null;
      }
    })();

    console.log("Subscriber welcome email trigger:", {
      user_id,
      email,
      subscription_tier,
      subscription_end,
      endDateStr,
      ts: new Date().toISOString(),
      source: "subscriber-welcome-email@v1"
    });

    const planName = subscription_tier || "Premium";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bem-vindo ao BioPeak ${planName}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;box-shadow:0 6px 24px rgba(2,6,23,.08);overflow:hidden">
            <div style="background:#0ea5e9;padding:20px;text-align:center">
              <img src="https://static.wixstatic.com/media/a025ad_8cbd13ffdb864246be31faddecf48b30~mv2.png" alt="BioPeak Premium" style="display:block;max-width:280px;width:280px;height:auto;margin:0 auto;border-radius:6px" />
            </div>
            <div style="padding:32px 24px">
              <h1 style="margin:0 0 8px 0;font-size:24px;line-height:1.2;color:#0f172a">👏 Assinatura ativada!</h1>
              <p style="margin:0 0 16px 0;color:#334155;font-size:16px;line-height:1.6">
                Seja bem-vindo(a) ao <strong>BioPeak ${planName}</strong>. A partir de agora você tem acesso às análises profundas com IA, recomendações personalizadas e insights avançados para acelerar sua evolução.
              </p>

              <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0;color:#0f172a;font-weight:600">Detalhes da assinatura</p>
                <ul style="margin:8px 0 0 18px;color:#475569;padding:0;font-size:14px;line-height:1.6">
                  <li>Plano: <strong>${planName}</strong></li>
                  ${endDateStr ? `<li>Renovação/expira em: <strong>${endDateStr}</strong></li>` : ''}
                </ul>
              </div>

              <div style="text-align:center;margin:24px 0 12px">
                <a href="https://biopeak-ai.com/app" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Explorar recursos Premium</a>
              </div>

              <p style="margin:12px 0 0;color:#64748b;font-size:14px;line-height:1.6;text-align:center">
                Dica: reanalise seus treinos recentes com a <strong>Análise Profunda de IA</strong> para ver insights adicionais liberados pelo seu plano.
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0" />

              <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">
                Precisa de ajuda? Responda este e-mail ou chame no Instagram <strong>@biopeak.ai</strong>.
              </p>
            </div>
            <div style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px">© ${new Date().getFullYear()} BioPeak. Transformando dados em performance.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "BioPeak <noreply@biopeak-ai.com>",
      to: [email],
      subject: "🎉 Assinatura ativa: bem-vindo(a) ao BioPeak Premium",
      html,
    });

    console.log("Resend response (subscriber-welcome-email):", emailResponse);

    const ok = !!emailResponse.data?.id;
    if (!ok) {
      throw new Error(`Falha ao enviar email: ${emailResponse.error?.message || "sem id retornado"}`);
    }

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in subscriber-welcome-email:", error);
    return new Response(JSON.stringify({ success: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
