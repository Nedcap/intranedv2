import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MANTÉM O SEU POST ORIGINAL DE CRIAÇÃO
export async function POST(request: Request) {
  try {
    const { nome, email, senha, cargo, permissoes } = await request.json();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true 
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: profileError } = await supabaseAdmin
      .from('usuarios')
      .insert([{
        id: authUser.user.id, 
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

// 🚨 LOGICA CORRIGIDA: Método PUT para atualizar a senha no Auth e ativar a flag no Banco Público
export async function PUT(request: Request) {
  try {
    const { userId, senha } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    if (senha && senha.trim().length >= 6) {
      // 1. Força a alteração de senha no Auth Nativo
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: senha.trim()
      });

      if (authError) {
        return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 });
      }

      // 2. Ativa o bloqueio de primeiro_acesso no banco público para forçar a troca na tela de login
      const { error: dbError } = await supabaseAdmin
        .from("usuarios")
        .update({ primeiro_acesso: true })
        .eq("id", userId);

      if (dbError) {
        return NextResponse.json({ error: `Erro no Banco: ${dbError.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: "Senha redefinida com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}