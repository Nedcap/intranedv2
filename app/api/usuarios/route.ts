import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ➕ MANTÉM O SEU POST ORIGINAL
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

// 🚨 LOGICA ATUALIZADA: Método PUT marcando a senha como temporária nos metadados
export async function PUT(request: Request) {
  try {
    const { userId, senha } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    // Se o admin digitou uma nova senha, força a atualização e marca como temporária
    if (senha && senha.trim().length >= 6) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: senha.trim(),
        // 🎯 O PULO DO GATO: Injeta a flag oculta de segurança que o front consegue ler ao logar
        app_metadata: {
          senha_temporaria: true
        }
      });

      if (authError) {
        return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: "Senha temporária gravada com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}