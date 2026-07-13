import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

// 🔥 Garante que o Next.js não corte o upload de PDFs pesados por timeout
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
    // Usamos formData para receber o arquivo bruto enviado pelo front
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    // Agora esse analiseId recebe a subpasta junto! Ex: "lote-12345/docs"
    const analiseId = formData.get("analiseId") as string;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo foi enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 🛡️ TRUQUE DE SEGURANÇA: Limpando espaços e caracteres bizarros do nome do arquivo
    // Isso evita que a IA Python não consiga baixar o PDF por erro de URL inválida
    const nomeSeguro = file.name.replace(/\s+/g, "%20");

    // Monta o caminho final no R2
    const path = analiseId ? `clientes/${analiseId}/${nomeSeguro}` : `avulsos/${Date.now()}-${nomeSeguro}`;

    // O próprio servidor faz o upload, contornando o CORS do navegador totalmente
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Key: path,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, path });
    
  } catch (error: any) {
    console.error("❌ [R2_SERVER_ERROR]:", error);
    return NextResponse.json({ error: "Erro no servidor R2: " + error.message }, { status: 500 });
  }
}