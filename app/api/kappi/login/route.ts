// Arquivo: app/api/kappi/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

const KAPPI_BASE_URL = "https://gateway-hhgatnejsq-uc.a.run.app";

// Criando uma interface para tipar a resposta da Kappi
interface KappiLoginResponse {
  access_token: string;
}

export async function POST(request: NextRequest) {
  try {
    // Puxando as variáveis de ambiente com segurança
    const email = process.env.KAPPI_EMAIL;
    const password = process.env.KAPPI_PASSWORD;

    if (!email || !password) {
      throw new Error("Credenciais da Kappi ausentes nas variáveis de ambiente (.env)");
    }

    const authResponse = await fetch(`${KAPPI_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store' 
    });

    if (!authResponse.ok) {
      throw new Error(`Erro ao logar na Kappi. Status: ${authResponse.status}`);
    }

    // Usando a tipagem que criamos lá em cima
    const authData: KappiLoginResponse = await authResponse.json();
    const token = authData.access_token;

    // Retornando o token para o seu front-end (sua Intranet)
    return NextResponse.json({ 
      success: true, 
      token: token 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Falha na API de Login da Kappi:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}