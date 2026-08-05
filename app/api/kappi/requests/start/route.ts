// Arquivo: app/api/kappi/requests/start/route.ts
import { NextRequest, NextResponse } from 'next/server';

const KAPPI_BASE_URL = "https://gateway-hhgatnejsq-uc.a.run.app";

interface KappiLoginResponse {
  access_token: string;
}

interface StartDiligenceRequest {
  rf_id: string;
}

interface DiligenceResponse {
  id?: string;
  diligence_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Recebe o CPF ou CNPJ do seu Frontend
    const body: StartDiligenceRequest = await request.json();
    const { rf_id } = body;

    if (!rf_id) {
      return NextResponse.json({ success: false, error: "O campo rf_id é obrigatório." }, { status: 400 });
    }

    const email = process.env.KAPPI_EMAIL;
    const password = process.env.KAPPI_PASSWORD;

    if (!email || !password) {
      throw new Error("Credenciais da Kappi ausentes nas variáveis de ambiente.");
    }

    // 2. Autentica na Kappi
    const authRes = await fetch(`${KAPPI_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store'
    });

    if (!authRes.ok) {
      throw new Error(`Falha na autenticação (Start): ${authRes.status}`);
    }

    const authData: KappiLoginResponse = await authRes.json();
    const token = authData.access_token;

    // 3. Dispara a Diligência na Kappi
    const diligenceRes = await fetch(`${KAPPI_BASE_URL}/diligences`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rf_id }),
      cache: 'no-store'
    });

    if (!diligenceRes.ok) {
      const errorText = await diligenceRes.text();
      throw new Error(`Erro ao iniciar diligência: ${errorText}`);
    }

    // 4. Captura o Protocolo (ID)
    const diligenceData: DiligenceResponse = await diligenceRes.json();
    
    // A documentação cita tanto "id" quanto "diligence_id". Pegamos o que vier.
    const protocolId = diligenceData.diligence_id || diligenceData.id; 

    return NextResponse.json({ 
      success: true, 
      diligence_id: protocolId 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro no Start Diligence:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}