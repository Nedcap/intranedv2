import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
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
    const { prefix } = await request.json();
    
    if (!prefix) {
      return NextResponse.json({ error: "Prefixo da pasta não informado" }, { status: 400 });
    }

    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME?.trim(),
      Prefix: prefix, // Vai buscar tudo dentro de "clientes/lote-XXX/"
    });

    const response = await s3Client.send(command);
    const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, ""); // Tira a barra do final se tiver
    
    // Filtra apenas os arquivos (ignora a própria pasta) e monta as URLs completas
    const urls = response.Contents
      ?.filter(item => item.Key && !item.Key.endsWith('/'))
      .map(item => {
        // Codifica a URL para não quebrar com espaços ou caracteres especiais
        const pathCodificado = item.Key!.split('/').map(segment => encodeURIComponent(segment)).join('/');
        return `${r2BaseUrl}/${pathCodificado}`;
      }) || [];

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error("Erro ao listar R2:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}