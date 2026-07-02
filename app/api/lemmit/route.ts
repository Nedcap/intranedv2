import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;

    // Faz a chamada limpa usando Axios.
    // Se rodar no Localhost, ele herda o IP exato da sua NordVPN ligada!
    const resposta = await axios.post(urlLemit, params.toString(), {
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj',
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const erroReal = error.response?.data || error.message;
    console.error('Erro na rota:', erroReal);
    return NextResponse.json(
      { error: 'Erro retornado pela API da Lemit.', detalhes: erroReal },
      { status: error.response?.status || 500 }
    );
  }
}