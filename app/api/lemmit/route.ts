import { NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN (Pegue no painel web da Nord)
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado
const NORD_PORT = '8989';        // Porta oficial de Proxy HTTP da NordVPN

const proxyUrl = `http://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;

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

    // Verifica se está rodando no seu PC (localhost) ou na nuvem (Vercel)
    const IsLocalhost = process.env.NODE_ENV === 'development' || request.url.includes('localhost');

    let fetchOptions: any = {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'force-cache', // Evita gastar seus créditos se o documento for repetido
    };

    if (IsLocalhost) {
      console.log(`[LOCAL DEV] Roteando chamada para ${docLimpo} isoladamente via Proxy HTTP NordVPN`);
      // No seu PC local, nós forçamos o uso do agente da NordVPN
      const agent = new HttpsProxyAgent(proxyUrl);
      fetchOptions.agent = agent;
    } else {
      console.log(`[PRODUCTION VERCEL] Disparando requisição via rede nativa padrão.`);
    }

    // Dispara a requisição
    const resposta = await fetch(urlLemit, fetchOptions);

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
    console.error('Erro na rota interna do servidor:', error.message);
    return NextResponse.json(
      { error: 'Falha interna ao processar a consulta.', detalhes: error.message },
      { status: 500 }
    );
  }
}