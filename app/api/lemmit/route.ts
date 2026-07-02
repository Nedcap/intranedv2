import { NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN (Pegue no seu painel manual da Nord)
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // O IP fixo que você contratou
const NORD_PORT = '80';          // Porta padrão de proxy HTTP da NordVPN

// Monta o túnel autenticado do Proxy
const proxyUrl = `http://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    // Limpa o documento (remove pontos, traços, etc)
    const docLimpo = documento.replace(/\D/g, '');

    // Formata o corpo do request como x-www-form-urlencoded exigido pela Lemit
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;

    console.log(`[PROXY ATIVO] Redirecionando consulta de ${docLimpo} via NordVPN`);

    // Faz a chamada oficial para a Lemit
    const resposta = await fetch(urlLemit, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial da Lemit [cite: 1]
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      // @ts-ignore - Força o Next.js a aceitar o Agent no fetch nativo
      agent: agent, 
      cache: 'force-cache', // Mágica do cache nativo do Next.js (Economiza seus créditos!)
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
    console.error('Erro na rota da Lemit:', error.message);
    return NextResponse.json(
      { error: 'Falha interna no servidor ao processar a consulta.', detalhes: error.message },
      { status: 500 }
    );
  }
}