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
        phone,
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

    // Inserir o perfil na tabela profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: data.user.id,
        display_name: name,
        phone: phone
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
