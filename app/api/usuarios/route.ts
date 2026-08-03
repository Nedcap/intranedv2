/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseAdmin, validarRequisicaoApi } from '@/lib/supabase-server';

// Função auxiliar para validar se o requisitante tem privilégios Master
async function validarAcessoMaster(request: Request) {
  const { usuario, erro } = await validarRequisicaoApi(request);
  if (erro || !usuario) {
    return { autorizado: false, respostaErro: NextResponse.json({ error: erro || "Acesso negado." }, { status: 401 }) };
  }

  const cargoLimpo = usuario.cargo?.toLowerCase().trim();
  if (cargoLimpo !== 'master') {
    return { autorizado: false, respostaErro: NextResponse.json({ error: "Acesso restrito a administradores Master." }, { status: 403 }) };
  }

  return { autorizado: true, usuario };
}

// ============================================================================
// 1. GET: Lista todos os usuários (Restrito a Master)
// ============================================================================
export async function GET(request: Request) {
  try {
    const check = await validarAcessoMaster(request);
    if (!check.autorizado) return check.respostaErro!;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================================
// 2. POST: Criação de um novo operador completo (Restrito a Master)
// ============================================================================
export async function POST(request: Request) {
  try {
    const check = await validarAcessoMaster(request);
    if (!check.autorizado) return check.respostaErro!;

    const { nome, email, senha, cargo, permissoes, notificacoes_config, bate_ponto } = await request.json();

    if (!email || !senha) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    // 1. Cria usuário no Auth (Cofre de senhas do Supabase)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha.trim(),
      email_confirm: true 
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    // 2. Injeta o perfil complementar na tabela pública com os novos campos
    const { error: profileError } = await supabaseAdmin
      .from('usuarios')
      .insert([{
        id: authUser.user.id, 
        nome: nome?.trim(),
        email: email.trim().toLowerCase(),
        cargo,
        permissoes,
        notificacoes_config: notificacoes_config || {},
        bate_ponto: bate_ponto || false
      }]);

    if (profileError) {
      // Rollback: se falhar no banco, deleta do Auth para não gerar usuário fantasma
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    console.log(`👤 [Novo Usuário] Criado por ${check.usuario!.nome}: ${email}`);

    return NextResponse.json({ success: true, user: { id: authUser.user.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================================
// 3. PUT: Atualiza Perfil, E-mail e Senha de forma sincronizada (Restrito a Master)
// ============================================================================
export async function PUT(request: Request) {
  try {
    const check = await validarAcessoMaster(request);
    if (!check.autorizado) return check.respostaErro!;

    const { userId, nome, email, senha, cargo, permissoes, notificacoes_config, bate_ponto } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    const emailTratado = email ? email.trim().toLowerCase() : undefined;

    // 1. Atualiza as informações do perfil na tabela pública
    const { error: dbError } = await supabaseAdmin
      .from("usuarios")
      .update({
        nome: nome?.trim(),
        email: emailTratado,
        cargo,
        permissoes,
        notificacoes_config,
        bate_ponto
      })
      .eq("id", userId);

    if (dbError) {
      return NextResponse.json({ error: `Erro ao atualizar perfil: ${dbError.message}` }, { status: 400 });
    }

    // 2. Sincroniza E-mail e Senha no Auth Nativo
    const authUpdates: any = {};
    if (emailTratado) authUpdates.email = emailTratado;
    if (senha && senha.trim().length >= 6) authUpdates.password = senha.trim();

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);

      if (authError) {
        return NextResponse.json({ error: `Erro ao sincronizar credenciais: ${authError.message}` }, { status: 400 });
      }

      // 3. Se houve troca de senha, ativa a flag para o usuário ser forçado a redefinir no login
      if (authUpdates.password) {
        await supabaseAdmin
          .from("usuarios")
          .update({ primeiro_acesso: true })
          .eq("id", userId);
      }
    }

    console.log(`⚙️ [Usuário Alterado] ID ${userId} atualizado por ${check.usuario!.nome}`);

    return NextResponse.json({ success: true, message: "Operador atualizado com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}