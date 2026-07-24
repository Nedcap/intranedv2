import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';

// 1. Inicializando os clientes (O Next.js/Vercel pega as envs automaticamente)
const redis = Redis.fromEnv();

// Dica: Use a SERVICE_ROLE_KEY no backend para contornar políticas de RLS e gravar direto
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. O Porteiro (Gerenciador de Token focado em HOMOLOGAÇÃO)
async function getSerasaToken() {
  const CACHE_KEY = 'serasa_auth_token_hml'; // Chave separada para homologação
  const cachedToken = await redis.get(CACHE_KEY);

  if (cachedToken) return cachedToken;

  const response = await fetch('https://uat-api.serasaexperian.com.br/security/iam/v1/client-identities/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Aqui vai o Basic Auth que eles vão te mandar no e-mail de homologação
      'Authorization': `Basic ${process.env.SERASA_BASIC_AUTH_HML}`
    }
  });

  if (!response.ok) throw new Error('Falha na autenticação Serasa HML');

  const data = await response.json();
  const newToken = `${data.TokenType} ${data.AccessToken}`;
  
  // Salva por 55 minutos (3300 segundos)
  await redis.set(CACHE_KEY, newToken, { ex: 3300 });

  return newToken;
}

// 3. A Rota Principal (Endpoint POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cnpj } = body; // Deve vir apenas números, ex: 12345678000199

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido. Envie 14 dígitos.' }, { status: 400 });
    }

    // PASSO A: Checa no Supabase se já consultamos esse CNPJ nos últimos 30 dias
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const { data: cachedData } = await supabase
      .from('consultas_serasa')
      .select('payload_raw')
      .eq('cnpj', cnpj)
      .gte('criado_em', trintaDiasAtras.toISOString())
      .order('criado_em', { ascending: false })
      .limit(1);

    if (cachedData && cachedData.length > 0) {
      console.log('✅ Cache Supabase! Economizamos uma consulta.');
      return NextResponse.json({ source: 'banco_de_dados', data: cachedData[0].payload_raw });
    }

    // PASSO B: Se não tem no banco, pega o Token e bate na Serasa (Homologação)
    console.log('⚠️ Indo buscar na Serasa...');
    const token = await getSerasaToken();

    // Aqui você configura qual relatório quer testar
    const reportName = 'RELATORIO_AVANCADO_TOP_SCORE_PJ';
    const serasaUrl = `https://uat-api.serasaexperian.com.br/credit-services/business-information-report/v1/reports?reportName=${reportName}`;

    const serasaResponse = await fetch(serasaUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token, // O Upstash já devolveu formatado "Bearer XXXXX"
        'X-Document-Id': cnpj,
        // 'X-Retailer-Document-Id': 'SEU_CNPJ' // Descomente e coloque se você for contrato distribuidor
      }
    });

    if (!serasaResponse.ok) {
      const errorBody = await serasaResponse.text();
      console.error('Erro na Serasa:', errorBody);
      return NextResponse.json({ error: 'Erro ao consultar Serasa', details: errorBody }, { status: serasaResponse.status });
    }

    const payloadRaw = await serasaResponse.json();

    // PASSO C: Salva o monstrão de dados no Supabase pra não pagar de novo
    await supabase.from('consultas_serasa').insert([
      {
        cnpj: cnpj,
        tipo_relatorio: reportName,
        payload_raw: payloadRaw,
        status_risco: 'PENDENTE' // O seu robô atualiza isso depois de analisar
      }
    ]);

    // PASSO D: Devolve para quem chamou a API
    return NextResponse.json({ source: 'serasa', data: payloadRaw });

  } catch (error: any) {
    console.error('Erro Fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}