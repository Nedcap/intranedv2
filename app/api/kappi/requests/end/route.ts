// Arquivo: app/api/kappi/requests/end/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { filtrarAnalisesPorEscopo, BaseKappiAnalysis } from '../../consultas/escopo';

const KAPPI_BASE_URL = "https://gateway-hhgatnejsq-uc.a.run.app";

interface KappiLoginResponse {
  access_token: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const diligenceId = searchParams.get('id');
    // Captura o tipo enviado na URL (ex: ?id=123&tipo=PJ ou ?id=123&tipo=PF)
    const tipo = (searchParams.get('tipo')?.toUpperCase() as 'PF' | 'PJ') || 'PJ';

    if (!diligenceId) {
      return NextResponse.json(
        { success: false, error: "O parâmetro 'id' da diligência é obrigatório." }, 
        { status: 400 }
      );
    }

    // 1. Puxando e validando as variáveis de ambiente
    const email = process.env.KAPPI_EMAIL;
    const password = process.env.KAPPI_PASSWORD;

    if (!email || !password) {
      throw new Error("Credenciais da Kappi ausentes nas variáveis de ambiente (.env).");
    }

    // 2. Autenticação na Kappi
    const authRes = await fetch(`${KAPPI_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store'
    });

    if (!authRes.ok) throw new Error(`Falha na autenticação (End): ${authRes.status}`);
    
    const authData: KappiLoginResponse = await authRes.json();
    const access_token = authData.access_token;

    // 3. Resgate dos dados da Diligência
    const resultRes = await fetch(`${KAPPI_BASE_URL}/diligence/${diligenceId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      cache: 'no-store'
    });

    if (!resultRes.ok) {
      const errorText = await resultRes.text();
      throw new Error(`Erro ao buscar resultados da diligência: ${errorText}`);
    }

    const resultData = await resultRes.json();

    // 4. Aplicação do Filtro do Escopo (PF ou PJ)
    if (resultData.analyses && Array.isArray(resultData.analyses)) {
      resultData.analyses = filtrarAnalisesPorEscopo(resultData.analyses as BaseKappiAnalysis[], tipo);
    }

    return NextResponse.json({ 
      success: true, 
      data: resultData 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro no Resgate da Diligência (End):", error);
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500 }
    );
  }
}