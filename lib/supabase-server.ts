import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. O CLIENTE DE DEUS (Chave Mestra)
// Usado apenas no backend para bypassar o RLS e fazer operações privilegiadas
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. O SEGURANÇA DA API (Validador de Token)
export async function validarRequisicaoApi(request: Request) {
  try {
    // A. Pega o token que o frontend enviou
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Acesso Negado. Token JWT ausente.');
    }

    const token = authHeader.replace('Bearer ', '');

    // B. Valida a autenticidade do token direto no motor do Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Token inválido, adulterado ou expirado.');
    }

    // C. Puxa o crachá completo do banco de dados
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil) {
      throw new Error('Perfil de usuário não encontrado no sistema.');
    }

    // Retorna o perfil validado para a API usar!
    return { usuario: perfil, erro: null };
  } catch (err: any) {
    return { usuario: null, erro: err.message };
  }
}