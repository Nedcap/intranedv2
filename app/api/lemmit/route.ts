import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');

    // 🎯 Ajuste de rota com base no painel da Lemit (Verificando se precisa de GET)
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}/${docLimpo}`;

    console.log(`[LOCAL DEV] Disparando requisição para: ${urlLemit}`);

    // Testando com axios.get porque o documento vai direto na URL (padrão de consultas GET)
    const resposta = await axios.get(urlLemit, {
      headers: {
        'Authorization': 'Bearer LSE3EuOPZJ3SODp4FuwbOExc5VoW67vcUtwWEDYY',
        'Content-Type': 'application/json'
      }
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    // Se der erro, printa a resposta exata da Lemit no terminal do seu VS Code
    const dadosErro = error.response?.data || error.message;
    console.error('❌ ERRO DETALHADO DA LEMIT NO TERMINAL:', dadosErro);
    
    return NextResponse.json(
      { error: 'Erro retornado pela API da Lemit.', detalhes: dadosErro },
      { status: error.response?.status || 500 }
    );
  }
}