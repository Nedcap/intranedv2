import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export async function POST(req: Request) {
  try {
    const { empresa_nome, documentos } = await req.json();

    if (!documentos || documentos.length === 0) {
      return NextResponse.json({ error: "Nenhum documento para exportar." }, { status: 400 });
    }

    // =========================================================================
    // 1. AUTENTICAÇÃO VIA OAUTH2 (Usando as suas variáveis da Vercel)
    // =========================================================================
    const oauth2Client = new google.auth.OAuth2(
      process.env.GCP_CLIENT_ID,
      process.env.GCP_CLIENT_SECRET
    );

    // Seta o Refresh Token para ele conseguir gerar novos Access Tokens automaticamente
    oauth2Client.setCredentials({
      refresh_token: process.env.GCP_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    
    // O ID da sua pasta "00. EM ANALISE" (Você precisa criar essa variável na Vercel)
    const PASTA_RAIZ_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // =========================================================================
    // 2. CRIAÇÃO DA SUBPASTA
    // =========================================================================
    const folderMetadata = {
      name: `Dossiê - ${empresa_nome}`,
      mimeType: "application/vnd.google-apps.folder",
      parents: PASTA_RAIZ_ID ? [PASTA_RAIZ_ID] : undefined,
    };
    
    const pastaRes = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
      // 🔥 OBRIGATÓRIO PARA SALVAR EM DRIVES COMPARTILHADOS 🔥
      supportsAllDrives: true, 
    });
    const pastaEmpresaId = pastaRes.data.id;

    // =========================================================================
    // 3. TRANSFERÊNCIA: CLOUDFLARE R2 -> GOOGLE DRIVE
    // =========================================================================
    const promessasUpload = documentos.map(async (doc: any) => {
      if (!doc.url) return;
      
      const fetchRes = await fetch(doc.url);
      if (!fetchRes.ok) throw new Error(`Falha ao baixar ${doc.url}`);
      
      const buffer = await fetchRes.arrayBuffer();
      const stream = new Readable();
      stream.push(Buffer.from(buffer));
      stream.push(null);

      const isPdf = doc.url.toLowerCase().includes(".pdf");
      const mimeType = isPdf ? "application/pdf" : "image/jpeg";
      const extensao = isPdf ? ".pdf" : ".jpg";

      // Usa o nome caprichado da IA
      const nomeFinalDrive = `${doc.nome_descritivo_ia || "Documento Extraido"}${extensao}`;

      // Upload pro Google Drive
      return drive.files.create({
        requestBody: {
          name: nomeFinalDrive,
          parents: pastaEmpresaId ? [pastaEmpresaId] : undefined,
        },
        media: {
          mimeType: mimeType,
          body: stream,
        },
        fields: "id, name, webViewLink",
        // 🔥 OBRIGATÓRIO PARA SALVAR EM DRIVES COMPARTILHADOS 🔥
        supportsAllDrives: true,
      });
    });

    const resultados = await Promise.allSettled(promessasUpload);
    
    const linksDrive = resultados
      .filter((r) => r.status === "fulfilled")
      .map((r: any) => r.value.data);

    return NextResponse.json({ 
      success: true, 
      pasta_id: pastaEmpresaId,
      arquivos_exportados: linksDrive 
    });

  } catch (error: any) {
    console.error("Erro na exportação pro Drive:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}