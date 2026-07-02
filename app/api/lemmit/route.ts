import { NextResponse } from 'next/server';
import { SocksProxyAgent } from 'socks-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN (Pegue no seu painel manual da Nord)
// Atenção: Use o Username e Password longos da aba "Configuração Manual"
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado
const NORD_PORT = '1080';        // Porta oficial SOCKS5 da NordVPN

// Monta a conexão isolada via SOCKS5
const proxyUrl = `socks://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;
const agent = new SocksProxyAgent(proxyUrl);

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

    console.log(`[TÚNEL SOCKS5] Enviando consulta de ${docLimpo} isoladamente via NordVPN...`);

    // Faz o fetch passando estritamente pelo túnel SOCKS5 da NordVPN
    const resposta = await fetch(urlLemit, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      // @ts-ignore
      agent: agent, 
      cache: 'force-cache', // Cache do Next.js salvando seus créditos
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
    console.error('Erro no túnel da NordVPN:', error.message);
    return NextResponse.json(
      { error: 'Falha na conexão isolada com o Proxy.', detalhes: error.message },
      { status: 500 }
    );
  }
}