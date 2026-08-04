import { NextResponse } from 'next/server';
import axios from 'axios';
import { validarRequisicaoApi } from "@/lib/supabase-server"; // 🛡️ Importando o segurança!

export async function POST(request: Request) {
  try {
    // 🔒 BLINDAGEM DA ROTA: Se não tiver o Token do seu sistema logado, barra!
    const { usuario, erro } = await validarRequisicaoApi(request);
    if (erro) {
      return NextResponse.json({ error: "Acesso Negado. Autenticação ausente ou inválida." }, { status: 401 });
    }

    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    // 🛑 CHAVE BLINDADA PELA VARIÁVEL DE AMBIENTE
    const apiKey = process.env.LEMIT_API_KEY;
    if (!apiKey) {
      console.error("❌ ERRO: A variável LEMIT_API_KEY não foi configurada no servidor.");
      return NextResponse.json({ error: 'Configuração de servidor pendente.' }, { status: 500 });
    }

    const docLimpo = documento.replace(/\D/g, '');
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;
    
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    console.log(`[VERCEL] Executando requisição segura para o Lemit (${tipo}) | Doc: ${docLimpo}`);

    const resposta = await axios.post(urlLemit, params.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`, // Usando a chave do .env
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const dadosErro = error.response?.data || error.message;
    console.error('❌ ERRO LEMIT:', dadosErro);
    
    return NextResponse.json(
      { error: 'Erro de comunicação com o fornecedor.', detalhes: dadosErro },
      { status: error.response?.status || 500 }
    );
  }
}