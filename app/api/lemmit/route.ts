import { NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado da NordVPN
const NORD_PORT = '8989';        // Porta oficial de Proxy HTTP da NordVPN (Evita o ETIMEDOUT)

// Monta a URL usando o protocolo HTTP padrão aceito pela Vercel
const proxyUrl = `http://${NORD_USER}:${NORD_PASS}@${NORD_IP}:${NORD_PORT}`;

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

    console.log(`[VERCEL HTTP PROXY] Disparando via porta 8989 para: ${docLimpo}`);

    // Inicializa o agente HTTP correto para a Vercel
    const agent = new HttpsProxyAgent(proxyUrl);

    // Faz a chamada oficial usando o Axios amarrado ao agente HTTP
    const resposta = await axios.post(urlLemit, params.toString(), {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 15000, // 15 segundos de margem
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Retorna os dados com sucesso para a sua tela visual
    return NextResponse.json(resposta.data);

  } catch (error: any) {
    console.error('Erro na execução do túnel Vercel:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        error: 'Erro na comunicação através do IP Dedicado.', 
        detalhes: error.response?.data || error.message 
      },
      { status: 500 }
    );
  }
}