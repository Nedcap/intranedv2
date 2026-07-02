import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    // Deixa apenas os números (limpa pontos e traços)
    const docLimpo = documento.replace(/\D/g, '');

    // 🎯 AJUSTE DO PRINT: O documento vai direto na URL!
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}/${docLimpo}`;

    console.log(`[API LEMIT] Consultando: ${urlLemit}`);

    // Faz a chamada oficial usando o seu token gerado
    const resposta = await axios.get(urlLemit, {
      headers: {
        // Mantemos a palavra Bearer com um espaço, seguido do SEU token real do print
        'Authorization': 'Bearer LSE3EuOPZJ3SODp4FuwbOExc5VoW67vcUtwWEDYY',
        'Content-Type': 'application/json'
      }
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const erroReal = error.response?.data || error.message;
    console.error('Erro retornado pela Lemit:', erroReal);
    return NextResponse.json(
      { error: 'Erro na API da Lemit.', detalhes: erroReal },
      { status: error.response?.status || 500 }
    );
  }
}