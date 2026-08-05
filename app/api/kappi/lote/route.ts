import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const KAPPI_BASE_URL = "https://gateway-hhgatnejsq-uc.a.run.app";

export async function POST(request: NextRequest) {
  try {
    const { documentos } = await request.json();

    if (!documentos || !Array.isArray(documentos)) {
      return NextResponse.json(
        { success: false, error: "O parâmetro 'documentos' deve ser um array." }, 
        { status: 400 }
      );
    }

    // 1. Faz o Login na Kappi para o lote
    const authRes = await fetch(`${KAPPI_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: process.env.KAPPI_EMAIL, 
        password: process.env.KAPPI_PASSWORD 
      }),
      cache: 'no-store'
    });

    if (!authRes.ok) throw new Error("Falha na autenticação da Kappi.");

    const { access_token } = await authRes.json();
    const resultados = [];

    // 2. Dispara as diligências uma por uma
    for (const item of documentos) {
      const docLimpo = (item.doc || item.cnpj || item).replace(/\D/g, "");

      const diligenceRes = await fetch(`${KAPPI_BASE_URL}/diligences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ rf_id: docLimpo }),
        cache: 'no-store'
      });

      if (diligenceRes.ok) {
        const data = await diligenceRes.json();
        const protocoloId = data.diligence_id || data.id;

        // 3. Salva na tabela 'analises' do Supabase usando o supabaseAdmin
        await supabaseAdmin.from('analises').insert({
          cnpj: docLimpo,
          empresa_nome: item.nome || 'Pessoa Jurídica Avulsa',
          kappi_diligence_id: protocoloId,
          kappi_status: 'AGUARDANDO',
          status: 'aberta'
        });

        resultados.push({ doc: docLimpo, protocolo: protocoloId, status: "ok" });
      }
    }

    return NextResponse.json({ success: true, lote: resultados });

  } catch (error: any) {
    console.error("Erro no processamento em lote da Kappi:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}