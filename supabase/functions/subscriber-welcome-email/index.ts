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
          <title>Bem-vindo ao Plano Pro de BioPeak</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;box-shadow:0 6px 24px rgba(2,6,23,.08);overflow:hidden">
            <div style="background:linear-gradient(135deg,#7B61FF,#4FD1C5);padding:20px 24px;text-align:left;position:relative">
              <img src="https://biopeak-ai.com/icon-512x512.png" alt="Logo BioPeak" style="display:block;width:40px;height:40px;border-radius:8px" />
            </div>

            <img src="https://static.wixstatic.com/media/a025ad_6cd49319a57444b2a618c04e023f870c~mv2.png" alt="Atleta correndo com elementos de dados ao fundo" style="display:block;width:100%;max-height:240px;object-fit:cover" />

            <div style="padding:32px 24px">
              <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#1A1A1A">🎉 Bem-vindo ao Plano Pro de BioPeak</h1>
              <p style="margin:0 0 16px 0;color:#334155;font-size:16px;line-height:1.7">
                👋 Olá atleta,<br/>
                Parabéns! Agora você faz parte do <strong>BioPeak ${planName}</strong>.
                A partir de hoje, você terá acesso a recursos avançados que vão transformar sua performance esportiva com a força da inteligência artificial:
              </p>

              <ul style="margin:0 0 16px 20px;color:#1F2937;padding:0;font-size:15px;line-height:1.8">
                <li>✅ <strong>Análises de IA Completas</strong> – treinos individualizados, análise de sono e insights personalizados.</li>
                <li>✅ <strong>BioPeak Fitness Score</strong> – métricas exclusivas que acompanham sua evolução e risco de overtraining.</li>
                <li>✅ <strong>Calendário de Provas</strong> – IA aplicada para otimizar sua preparação para objetivos e competições.</li>
                <li>✅ <strong>Painel Estatístico Avançado</strong> – visualização detalhada de todas as suas estatísticas.</li>
                <li>✅ <strong>Monitoramento de Overtraining</strong> – alertas inteligentes para prevenir lesões e otimizar sua recuperação.</li>
                <li>✅ <strong>Insights de Performance</strong> – recomendações personalizadas para atingir seus objetivos mais rápido.</li>
              </ul>

              <p style="margin:0 0 20px 0;color:#111827;font-weight:600">🚀 Você está pronto para treinar de forma mais inteligente do que nunca!</p>

              <div style="text-align:center;margin:28px 0 8px">
                <a href="https://biopeak-ai.com/dashboard" style="display:inline-block;background:#7B61FF;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700">Acessar meu Painel</a>
              </div>

              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin:20px 0">
                <p style="margin:0 0 6px 0;color:#0f172a;font-weight:700">Detalhes da assinatura</p>
                <ul style="margin:0 0 0 18px;color:#475569;padding:0;font-size:14px;line-height:1.6">
                  <li>Plano: <strong>${planName}</strong></li>
                  ${endDateStr ? `<li>Renovação/expira em: <strong>${endDateStr}</strong></li>` : ''}
                </ul>
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
      subject: "🎉 Bem-vindo ao Plano Pro de BioPeak – sua jornada inteligente de performance começa agora!",
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
