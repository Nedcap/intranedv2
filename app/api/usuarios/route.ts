import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializa o Supabase com a chave SERVICE ROLE (mestre)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Essa chave permite gerenciar usuários sem deslogar o admin
);

export async function POST(request: Request) {
  try {
    const { nome, email, senha, cargo, permissoes } = await request.json();

    // 1. Cria o usuário no sistema de Auth nativo do Supabase
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true // Já cria o e-mail como confirmado
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // 2. Insere os dados complementares na sua tabela pública usando o mesmo ID gerado
    const { error: profileError } = await supabaseAdmin
      .from('usuarios')
      .insert([{
        id: authUser.user.id, // O mesmo UUID do Auth!
        nome,
        email,
        cargo,
        permissoes
      }]);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}