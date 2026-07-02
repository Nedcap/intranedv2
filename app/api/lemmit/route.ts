import { NextResponse } from 'next/server';
import axios from 'axios';

// 🔐 CREDENCIAIS DE SERVIÇO DA NORDVPN
const NORD_USER = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
const NORD_PASS = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';   
const NORD_IP = '153.53.226.43'; // Seu IP dedicado da NordVPN
const NORD_PORT = 8989;          // Porta oficial de Proxy HTTP da NordVPN (Mantenha como número)

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

    console.log(`[VERCEL NATIVE PROXY] Roteando chamada para ${docLimpo} via objeto Axios.`);

    // Faz a chamada oficial usando a configuração nativa de proxy do Axios
    // Isso faz a Vercel empacotar o tráfego de forma limpa
    const resposta = await axios.post(urlLemit, params.toString(), {
      proxy: {
        protocol: 'http',
        host: NORD_IP,
        port: NORD_PORT,
        auth: {
          username: NORD_USER,
          password: NORD_PASS
        }
      },
      timeout: 15000, // 15 segundos
      headers: {
        'Authorization': 'Bearer TFO3yrBrjnM8i2BCYeYUhRGRSEWqrx3O5HkkbQCj', // Token oficial
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Retorna os dados com sucesso para o front-end
    return NextResponse.json(resposta.data);

  } catch (error: any) {
    // Se a Lemit rejeitar o tráfego após o proxy conectar, captura a resposta real deles aqui
    const erroReal = error.response?.data || error.message;
    console.error('Erro na execução do túnel Vercel:', erroReal);
    
    return NextResponse.json(
      { 
        error: 'Erro na comunicação através do IP Dedicado.', 
        detalhes: erroReal 
      },
      { status: 500 }
    );
  }
}