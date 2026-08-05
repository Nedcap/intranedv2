/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { validarRequisicaoApi } from "@/lib/supabase-server"; // 🛡️ Importando a blindagem

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID?.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() as string,
  },
});

export async function POST(request: Request) {
  try {
    // 🐛 DEBUG 1: Vamos descobrir se o token está chegando no upload
    const authHeader = request.headers.get("authorization");
    console.log("[DEBUG UPLOAD] Header Authorization recebido:", authHeader ? "✅ SIM" : "❌ NÃO");

    // 🔒 BLINDAGEM DA ROTA
    const { usuario, erro } = await validarRequisicaoApi(request);
    if (erro || !usuario) {
      console.error("[ERRO AUTENTICAÇÃO UPLOAD]:", erro);
      return NextResponse.json({ error: erro || "Acesso negado. Token ausente ou inválido." }, { status: 401 });
    }

    // 🐛 DEBUG 2: Protegendo o parse do JSON (se o frontend mandar FormData, isso aqui quebra)
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[ERRO PARSE JSON] Frontend enviou algo que não é JSON. Talvez FormData?");
      return NextResponse.json({ error: "Corpo da requisição deve ser um JSON válido." }, { status: 400 });
    }

    const { fileName, fileType, analiseId } = body;

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "Nome ou tipo do arquivo não fornecidos." }, { status: 400 });
    }

    // 🧽 SANITIZAÇÃO
    const nomeSeguro = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // 🎯 PASTA ESTRUTURADA NO R2
    const path = analiseId ? `clientes/${analiseId}/${nomeSeguro}` : `avulsos/${Date.now()}-${nomeSeguro}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Key: path,
      ContentType: fileType,
    });

    // 🔑 Gera a URL de permissão
    const url = await getSignedUrl(s3Client, command, { expiresIn: 120 });

    console.log(`☁️ [R2 Upload] URL gerada para: ${path} (Solicitado por: ${usuario.nome})`);

    return NextResponse.json({ success: true, url, path });
    
  } catch (error: any) {
    console.error("❌ [R2_SERVER_ERROR]:", error);
    return NextResponse.json({ error: "Erro ao gerar autorização do R2: " + error.message }, { status: 500 });
  }
}