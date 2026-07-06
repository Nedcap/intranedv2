import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export async function POST(request: Request) {
  try {
    const { fileName, fileType, analiseId } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "Faltam dados do arquivo" }, { status: 400 });
    }

    // Organização de pastas inteligente: se vier o analiseId (CNPJ limpo), joga na pasta do cliente, senão cria um avulso com timestamp
    const path = analiseId ? `clientes/${analiseId}/${fileName}` : `avulsos/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: path,
      ContentType: fileType,
    });

    // Gera a URL assinada válida por 60 segundos para o front-end injetar o PUT direto
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return NextResponse.json({ signedUrl, path });
    
  } catch (error: any) {
    console.error("Erro real ao gerar URL do R2:", error);
    return NextResponse.json({ error: "Erro interno no servidor: " + error.message }, { status: 500 });
  }
}