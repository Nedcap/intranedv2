import { NextResponse } from 'next/server';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado
const NORD_PORT = '1080';        // Porta oficial SOCKS5 da NordVPN

// Cria o túnel SOCKS5
const proxyUrl = `socks://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;
const agent = new SocksProxyAgent(proxyUrl);

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

    console.log(`[VERCEL PROXY] Enviando consulta de ${docLimpo} via Axios + SOCKS5`);

    // Faz a chamada usando o Axios (que força a Vercel a usar o túnel SOCKS5)
    const resposta = await axios.post(urlLemit, params.toString(), {
      httpAgent: agent,
      httpsAgent: agent,
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Retorna os dados com sucesso
    return NextResponse.json(resposta.data);

  } catch (error: any) {
    console.error('Erro no túnel da Vercel/NordVPN:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        error: 'Erro na comunicação através do IP Dedicado.', 
        detalhes: error.response?.data || error.message 
      },
      { status: error.response?.status || 500 }
    );
  }
}