import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();
    if (!tipo || !documento) return NextResponse.json({ error: 'Dados obrigatórios.' }, { status: 400 });

    const docLimpo = documento.replace(/\D/g, '');
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    const resposta = await fetch(`https://api.lemit.com.br/api/v1/consulta/${tipo}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'force-cache',
    });

    if (!resposta.ok) return NextResponse.json({ error: 'Erro na API Lemit.' }, { status: resposta.status });
    return NextResponse.json(await resposta.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}