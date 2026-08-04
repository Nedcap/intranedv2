import { NextResponse } from 'next/server';
import axios from 'axios';
import { validarRequisicaoApi } from "@/lib/supabase-server"; // Seu segurança!

export async function POST(request: Request) {
  try {
    // 1. Blindagem de segurança
    const { usuario, erro } = await validarRequisicaoApi(request);
    if (erro) {
      return NextResponse.json({ error: "Acesso Negado." }, { status: 401 });
    }

    // Pega os dados que vieram do Frontend (tipo e documento)
    const body = await request.json();

    // 2. 🔥 A URL MÁGICA DO SEU NGROK 
    const urlDoNgrok = "https://dinghy-many-herself.ngrok-free.dev"; 

    console.log(`[VERCEL] ➔ Repassando pacote para o PC Local (Escritório)...`);

    // 3. Manda para o script rodando no seu PC local
    // (Ele vai bater na rota /proxy-lemit que criamos no server.js)
    const resposta = await axios.post(`${urlDoNgrok}/proxy-lemit`, body);

    // 4. Devolve para o Frontend o que o PC local retornou da Lemit
    return NextResponse.json(resposta.data);

  } catch (error: any) {
    console.error('❌ ERRO NO TÚNEL VERCEL -> PC LOCAL:', error.message);
    return NextResponse.json({ error: 'Erro de comunicação no túnel local.' }, { status: 500 });
  }
}