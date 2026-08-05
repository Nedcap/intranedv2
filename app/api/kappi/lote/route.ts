import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server'; // Seu client do Supabase

const KAPPI_BASE_URL = "https://gateway-hhgatnejsq-uc.a.run.app";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { documentos } = await request.json(); // ex: [{ doc: "123", tipo: "PF" }, ...]

    // 1. Faz o Login na Kappi uma única vez para o lote todo
    const authRes = await fetch(`${KAPPI_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: process.env.KAPPI_EMAIL, 
        password: process.env.KAPPI_PASSWORD 
      })
    });
    const { access_token } = await authRes.json();

    const resultados = [];

    // 2. Loop disparando os robôs na Kappi e salvando no Supabase
    for (const item of documentos) {
      const diligenceRes = await fetch(`${KAPPI_BASE_URL}/diligences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ rf_id: item.doc })
      });

      if (diligenceRes.ok) {
        const { diligence_id, id } = await diligenceRes.json();
        const protocoloId = diligence_id || id;

        // 3. Salva no Supabase!
        await supabase.from('kappi_diligencias').insert({
          documento: item.doc,
          diligence_id: protocoloId,
          tipo_escopo: item.tipo,
          status: 'AGUARDANDO'
        });

        resultados.push({ doc: item.doc, protocolo: protocoloId, status: "ok" });
      }
    }

    return NextResponse.json({ success: true, lote: resultados });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}