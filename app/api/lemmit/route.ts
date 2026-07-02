import { NextResponse } from 'next/server';

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

    // Captura o IP real do seu Chrome que a Vercel recebe
    const ipDoCliente = request.headers.get('x-forwarded-for') || '153.53.226.43';

    console.log(`[FORWARD INTERNO] Repassando IP do navegador: ${ipDoCliente}`);

    const resposta = await fetch(urlLemit, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj',
        'Content-Type': 'application/x-www-form-urlencoded',
        // Força a Lemit a ler o IP que o seu Chrome gerou na extensão!
        'X-Forwarded-For': ipDoCliente,
        'Client-Ip': ipDoCliente
      },
      body: params.toString(),
      cache: 'no-store' // Desativa o cache temporariamente para testar a rota limpa
    });

    if (!resposta.ok) {
      const erroDados = await resposta.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Erro retornado pela API da Lemit.', detalhes: erroDados },
        { status: resposta.status }
      );
    }

    const dados = await resposta.json();
    return NextResponse.json(dados);

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Falha na ponte de rede.', detalhes: error.message },
      { status: 500 }
    );
  }
}