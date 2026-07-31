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
    // 1. AUTENTICAÇÃO VIA SERVICE ACCOUNT (Robô - Imune a políticas de Workspace)
    // =========================================================================
    // Substitui a quebra de linha literal que a Vercel às vezes injeta
    const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });
    
    // O ID da sua pasta "00. EM ANALISE" na Vercel
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

      // 🔥 NOVA LÓGICA: Extrair o nome original direto da URL
      let nomeOriginal = `Documento_Extraido${extensao}`;
      try {
        const urlSemParametros = doc.url.split(/[?#]/)[0]; // Tira ? e # do final
        const partesUrl = urlSemParametros.split('/');
        nomeOriginal = decodeURIComponent(partesUrl[partesUrl.length - 1]); // Pega a última parte e limpa os %20
      } catch (e) {
        console.error("Erro ao extrair nome original da URL", e);
      }

      // Se a IA gerou um nome descritivo, usa ele + extensão. 
      // Se não, usa o nome original do arquivo que extraímos da URL.
      const nomeFinalDrive = doc.nome_descritivo_ia 
        ? `${doc.nome_descritivo_ia}${extensao}` 
        : nomeOriginal;

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