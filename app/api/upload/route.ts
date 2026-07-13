/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
    // 🛡️ VERIFICAÇÃO DE SEGURANÇA: Checa o tamanho da requisição direto no cabeçalho antes de processar
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 52428800) { // 50MB em bytes
      return NextResponse.json(
        { error: "Lote de arquivos excede o limite máximo de 50MB permitido." }, 
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const analiseId = formData.get("analiseId") as string;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo foi enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 🎯 Mantendo seu padrão limpo de pastas estruturadas no R2
    const path = analiseId ? `clientes/${analiseId}/${file.name}` : `avulsos/${Date.now()}-${file.name}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Key: path,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Retorna o PATH exato gerado no R2 para o frontend
    return NextResponse.json({ success: true, path });
    
  } catch (error: any) {
    console.error("❌ [R2_SERVER_ERROR]:", error);
    
    // Captura amigável caso o estouro de tamanho ocorra durante o parse do formData
    if (error.message?.includes("large") || error.code === "ERR_HTTP_INVALID_STATUS_CODE") {
      return NextResponse.json(
        { error: "O arquivo enviado é grande demais para o manipulador da API." }, 
        { status: 413 }
      );
    }
    
    return NextResponse.json({ error: "Erro no servidor R2: " + error.message }, { status: 500 });
  }
}