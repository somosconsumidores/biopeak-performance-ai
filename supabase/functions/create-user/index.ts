import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  metadata?: {
    [key: string]: any;
  };
}

// Normaliza para o formato: 55 + DDD + número (apenas dígitos)
// Exemplos:
//  - "(11) 99999-1234" -> "5511999991234"
//  - "11999991234" -> "5511999991234"
//  - "+55 11 99999-1234" -> "5511999991234"
const normalizePhoneBR55 = (phone?: string): string | null => {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Já está com 55 (Brasil)
  if (digits.startsWith('55')) return digits;

  // DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // Qualquer outro formato inesperado: salva apenas dígitos (melhor que quebrar o cadastro)
  return digits;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email, password, name, phone, metadata }: CreateUserRequest = await req.json();
    const normalizedPhone = normalizePhoneBR55(phone);

    // Validações básicas
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[create-user] Tentando criar usuário: ${email}`);

    // Criar usuário usando admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma email
      user_metadata: {
        display_name: name,
        phone: normalizedPhone,
        ...metadata
      }
    });

    if (error) {
      console.error(`[create-user] Erro ao criar usuário:`, error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[create-user] Usuário criado com sucesso: ${data.user.id}`);

    // Inserir ou atualizar o perfil na tabela profiles (upsert)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: data.user.id,
        display_name: name,
        phone: normalizedPhone,
        utm_source: metadata?.utm_source || null
      }, {
        onConflict: 'user_id'
      });

    if (profileError) {
      console.error(`[create-user] Erro ao criar perfil:`, profileError);
      // Não retornar erro aqui para não bloquear o cadastro
      // O perfil pode ser criado posteriormente
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[create-user] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
