import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
}

interface User {
  email: string;
  id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    if (!hookSecret) {
      console.error('SEND_EMAIL_HOOK_SECRET not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const wh = new Webhook(hookSecret);
    
    let webhookData;
    try {
      webhookData = wh.verify(payload, headers) as {
        user: User;
        email_data: EmailData;
      };
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return new Response('Unauthorized', { status: 401 });
    }

    const { user, email_data } = webhookData;
    const { token_hash, redirect_to, email_action_type } = email_data;

    // Generate appropriate email content based on action type
    let subject: string;
    let htmlContent: string;

    switch (email_action_type) {
      case 'recovery':
        subject = 'Recuperação de Senha - BioPeak';
        htmlContent = generateRecoveryEmailHTML(token_hash, redirect_to, email_data.site_url);
        break;
      
      case 'signup':
      case 'email_change':
        subject = 'Confirmação de Email - BioPeak';
        htmlContent = generateConfirmationEmailHTML(token_hash, redirect_to, email_data.site_url);
        break;
      
      case 'invite':
        subject = 'Convite para BioPeak';
        htmlContent = generateInviteEmailHTML(token_hash, redirect_to, email_data.site_url);
        break;
      
      default:
        subject = 'BioPeak - Ação Necessária';
        htmlContent = generateGenericEmailHTML(token_hash, redirect_to, email_data.site_url);
        break;
    }

    const emailResponse = await resend.emails.send({
      from: 'Relacionamento BioPeak <noreply@biopeak-ai.com>',
      to: [user.email],
      subject: subject,
      html: htmlContent,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

function generateRecoveryEmailHTML(tokenHash: string, redirectTo: string, siteUrl: string): string {
  const resetUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Senha - BioPeak</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">BioPeak</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Sua plataforma de performance esportiva</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Recuperação de Senha</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Olá atleta! Clique no link abaixo para gerar uma nova senha:
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Redefinir Senha
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            Se você não solicitou esta alteração, pode ignorar este email com segurança. Sua senha permanecerá inalterada.
          </p>
          
          <p style="color: #a0aec0; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
            Este link expira em 1 hora por motivos de segurança.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            © 2024 BioPeak. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateConfirmationEmailHTML(tokenHash: string, redirectTo: string, siteUrl: string): string {
  const confirmUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmação de Email - BioPeak</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">BioPeak</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Bem-vindo(a) à nossa comunidade!</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Confirme seu Email</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Olá atleta! Clique no link abaixo para confirmar seu email e ativar sua conta:
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Confirmar Email
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            Se você não criou esta conta, pode ignorar este email com segurança.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            © 2024 BioPeak. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateInviteEmailHTML(tokenHash: string, redirectTo: string, siteUrl: string): string {
  const inviteUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=invite&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite para BioPeak</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">BioPeak</h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Você foi convidado(a)!</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Convite Especial</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Olá atleta! Você foi convidado(a) para se juntar ao BioPeak. Clique no link abaixo para aceitar o convite:
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Aceitar Convite
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            Se você não esperava este convite, pode ignorar este email com segurança.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            © 2024 BioPeak. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateGenericEmailHTML(tokenHash: string, redirectTo: string, siteUrl: string): string {
  const actionUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BioPeak - Ação Necessária</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">BioPeak</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 20px;">
          <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Ação Necessária</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Olá atleta! Clique no link abaixo para prosseguir:
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Prosseguir
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
          <p style="color: #a0aec0; font-size: 12px; margin: 0;">
            © 2024 BioPeak. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(handler);