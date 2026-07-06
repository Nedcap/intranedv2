import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

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
    const analiseId = formData.get("analiseId") as string;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo foi enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = analiseId ? `clientes/${analiseId}/${file.name}` : `avulsos/${Date.now()}-${file.name}`;

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