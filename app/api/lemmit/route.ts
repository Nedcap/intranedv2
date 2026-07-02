import { NextResponse } from 'next/server';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado da NordVPN
const NORD_PORT = '1080';        // Porta oficial SOCKS5 da NordVPN

// Cria a URL de conexão do proxy
const proxyUrl = `socks://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');

    // Formata o corpo exatamente como a Lemit exige (x-www-form-urlencoded)
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;

    console.log(`[VERCEL SOCKS5] Disparando requisição via Axios para: ${docLimpo}`);

    // Criamos o agente explicitamente dentro do escopo da execução da Vercel
    const agent = new SocksProxyAgent(proxyUrl);

    // Faz a chamada usando o Axios injetando o agente SOCKS5 diretamente
    const resposta = await axios.post(urlLemit, params.toString(), {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 15000, // Dá 15 segundos de folga para a conexão estabilizar via Los Angeles
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Retorna os dados com sucesso
    return NextResponse.json(resposta.data);

  } catch (error: any) {
    console.error('Erro na execução do túnel Vercel:', error.response?.data || error.message);
    
    // Retorna o detalhe real do erro para não mascarar no front-end
    return NextResponse.json(
      { 
        error: 'Erro interno na rota do servidor.', 
        detalhes: error.response?.data || error.message 
      },
      { status: 500 }
    );
  }
}