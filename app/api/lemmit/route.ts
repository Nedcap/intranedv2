import { NextResponse } from 'next/server';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export async function POST(request: Request) {
  try {
    const { tipo, documento } = await request.json();

    if (!tipo || !documento) {
      return NextResponse.json({ error: 'Tipo e documento são obrigatórios.' }, { status: 400 });
    }

    const docLimpo = documento.replace(/\D/g, '');
    const urlLemit = `https://api.lemit.com.br/api/v1/consulta/${tipo}`;
    
    const params = new URLSearchParams();
    params.append('documento', docLimpo);

    // 🔐 CONFIGURAÇÃO DO SEU PROXY DEDICADO DA NORDVPN
    // Substitua 'SEU_USUARIO_NORD' e 'SUA_SENHA_NORD' pelas suas credenciais de serviço da NordVPN
    // (Aquelas que você encontra no painel web da NordVPN em "Configuração manual / Service Credentials")
    const usuarioNord = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
    const senhaNord = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';
    const servidorNord = 'us4970.nordvpn.com'; // O número do seu servidor do print

    // Criamos o agente que força a Vercel a mascarar a requisição com o seu IP Dedicado
    const proxyAgent = new HttpsProxyAgent(`http://${usuarioNord}:${senhaNord}@${servidorNord}:89`);

    console.log(`[VERCEL PROXY] Encaminhando requisição via IP Dedicado NordVPN...`);

    const resposta = await axios.post(urlLemit, params.toString(), {
      headers: {
        'Authorization': 'Bearer LSE3EuOPZJ3SODp4FuwbOExc5VoW67vcUtwWEDYY',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      httpsAgent: proxyAgent, // Força o uso do agente de rede
      proxy: false // Desativa o proxy padrão para usar o agente customizado acima
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const dadosErro = error.response?.data || error.message;
    console.error('❌ ERRO NA OPERAÇÃO DE PROXY:', dadosErro);
    
    return NextResponse.json(
      { error: 'Erro de comunicação através do IP Dedicado.', detalhes: dadosErro },
      { status: error.response?.status || 500 }
    );
  }
}