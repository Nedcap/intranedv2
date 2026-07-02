import { NextResponse } from 'next/server';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado da NordVPN

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    // Aponta para o nosso bypass interno configurado no next.config.ts
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;

    const resposta = await fetch(urlLemit, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token Lemit
        'Content-Type': 'application/x-www-form-urlencoded',
        // Injeta as credenciais de serviço da Nord codificadas em Base64 padrão web
        'Proxy-Authorization': 'Basic ' + Buffer.from(`${NORD_USER}:${NORD_PASS}`).toString('base64'),
        'X-Forwarded-For': NORD_IP // Força o IP Dedicado na saída
      },
      body: params.toString(),
      cache: 'force-cache' // Guarda a consulta para não gastar créditos à toa
    });

    if (!resposta.ok) {
      const erroDados = await resposta.json().catch(() => ({}));
      return NextResponse.json({ error: 'Erro na API Lemit.', detalhes: erroDados }, { status: resposta.status });
    }

    const dados = await resposta.json();
    return NextResponse.json(dados);

  } catch (error: any) {
    return NextResponse.json({ error: 'Falha na rota do servidor.', detalhes: error.message }, { status: 500 });
  }
}