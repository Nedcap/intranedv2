import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;
    
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    console.log(`[VERCEL] Executando requisição limpa padrão...`);

    const resposta = await axios.post(urlLemit, params.toString(), {
      headers: {
        'Authorization': 'Bearer LSE3EuOPZJ3SODp4FuwbOExc5VoW67vcUtwWEDYY',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const dadosErro = error.response?.data || error.message;
    console.error('❌ ERRO:', dadosErro);
    
    return NextResponse.json(
      { error: 'Erro de comunicação com o fornecedor.', detalhes: dadosErro },
      { status: error.response?.status || 500 }
    );
  }
}