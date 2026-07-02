import { NextResponse } from 'next/server';
import axios from 'axios';

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

    // 🔐 CREDENCIAIS DO SEU PAINEL DA NORDVPN
    const usuarioNord = '4LQDCWTn4kB7tm6EnvwFfLbn'; 
    const senhaNord = 'Cj3FbeJ1ZRnLtjVmxg51Pkn2';
    
    // 💻 ENDEREÇO DA MESHNET DO SEU PC
    const servidorMeshnet = 'alyson.tres-everest.nord'; 

    console.log(`[VERCEL] Encaminhando requisição para o PC Local via Nord Meshnet...`);

    const resposta = await axios.post(urlLemit, params.toString(), {
      headers: {
        'Authorization': 'Bearer LSE3EuOPZJ3SODp4FuwbOExc5VoW67vcUtwWEDYY',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      // 🎯 Encaminha o tráfego de forma criptografada para o seu PC
      proxy: {
        protocol: 'http',
        host: servidorMeshnet,
        port: 80, // A Meshnet escuta requisições de proxy na porta padrão 80
        auth: {
          username: usuarioNord,
          password: senhaNord
        }
      },
      // ⏳ Evita timeouts prematuros na Vercel enquanto a conexão faz a rota
      timeout: 15000 
    });

    return NextResponse.json(resposta.data);

  } catch (error: any) {
    const dadosErro = error.response?.data || error.message;
    console.error('❌ ERRO:', dadosErro);
    
    return NextResponse.json(
      { error: 'Erro de comunicação através da Meshnet/IP Dedicado.', detalhes: dadosErro },
      { status: error.response?.status || 500 }
    );
  }
}