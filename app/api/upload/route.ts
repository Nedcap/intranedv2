import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { fileName, fileType, analiseId } = await request.json();

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const bucketName = process.env.R2_BUCKET_NAME?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

    if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
      console.error("❌ [R2_ERROR] Faltam variáveis de ambiente essenciais no servidor!");
      return NextResponse.json({ error: "Configuração do servidor incompleta (Env Vars)." }, { status: 500 });
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const path = analiseId ? `clientes/${analiseId}/${fileName}` : `avulsos/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      ContentType: fileType,
    });

    // 🔥 O SEGREDO DO R2: Força o SDK a desativar os headers de SHA256 que forçam o Preflight
    const signedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 300,
      signableHeaders: new Set(["host", "content-type"]), // Assina APENAS o host e o tipo do arquivo
    });

    console.log("--------------------------------------------------");
    console.log("🎯 URL ASSINADA LIMPA GERADA:", signedUrl);
    console.log("--------------------------------------------------");

    return NextResponse.json({ signedUrl, path });
    
  } catch (error: any) {
    console.error("❌ [R2_CRITICAL_ERROR]:", error);
    return NextResponse.json({ error: "Erro interno no R2: " + error.message }, { status: 500 });
  }
}