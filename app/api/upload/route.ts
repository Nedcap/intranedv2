/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

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
    // ⚠️ Agora recebemos um JSON leve apenas com os metadados, e não mais o FormData (o arquivo em si)
    const { fileName, fileType, analiseId } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "Nome ou tipo do arquivo não fornecidos." }, { status: 400 });
    }

    // 🧽 SANITIZAÇÃO: Mantive a sua lógica para remover espaços, acentos e caracteres estranhos
    const nomeSeguro = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // 🎯 Mantendo seu padrão limpo de pastas estruturadas no R2
    const path = analiseId ? `clientes/${analiseId}/${nomeSeguro}` : `avulsos/${Date.now()}-${nomeSeguro}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Key: path,
      ContentType: fileType, // Essencial passar o ContentType aqui para o R2 salvar com a extensão correta
    });

    // 🔑 Gera a URL de permissão (Presigned URL) válida por 2 minutos
    const url = await getSignedUrl(s3Client, command, { expiresIn: 120 });

    // Retorna a URL de upload DIRETO e o PATH exato gerado para o frontend
    return NextResponse.json({ success: true, url, path });
    
  } catch (error: any) {
    console.error("❌ [R2_SERVER_ERROR]:", error);
    return NextResponse.json({ error: "Erro ao gerar autorização do R2: " + error.message }, { status: 500 });
  }
}