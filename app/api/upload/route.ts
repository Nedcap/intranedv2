import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

// ✅ CORREÇÃO 1: Adiciona as flags experimentais/oficiais de limite de tamanho de corpo de requisição do Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Abre o cano para arquivos de até 50MB
    },
  },
};

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
    // ✅ CORREÇÃO 2: Verificação de segurança preventiva para o tamanho do cabeçalho Content-Length
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 52428800) { // 50MB em bytes
      return NextResponse.json({ error: "Lote de arquivos excede o limite máximo de 50MB permitido." }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const analiseId = formData.get("analiseId") as string;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo foi enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 🔥 Mantendo seu padrão limpo e sem gambiarras
    const path = analiseId ? `clientes/${analiseId}/${file.name}` : `avulsos/${Date.now()}-${file.name}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Key: path,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Retornamos o PATH exato gerado no R2
    return NextResponse.json({ success: true, path });
    
  } catch (error: any) {
    console.error("❌ [R2_SERVER_ERROR]:", error);
    
    // ✅ CORREÇÃO 3: Captura amigável se o próprio parse do formData estourar limites internos do node
    if (error.message?.includes("large") || error.code === "ERR_HTTP_INVALID_STATUS_CODE") {
      return NextResponse.json({ error: "O arquivo enviado é grande demais para o manipulador da API." }, { status: 413 });
    }
    
    return NextResponse.json({ error: "Erro no servidor R2: " + error.message }, { status: 500 });
  }
}