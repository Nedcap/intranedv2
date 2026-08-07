import { NextResponse } from "next/server";
import { google } from "googleapis";
import { validarRequisicaoApi } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    // 🔒 1. Exige que quem chama está logado no seu sistema
    const { usuario, erro } = await validarRequisicaoApi(req);
    if (erro) {
      return NextResponse.json({ error: erro }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json({ error: "O ID da pasta não foi informado." }, { status: 400 });
    }

    // 🤖 2. AUTENTICAÇÃO DO ROBÔ (SERVICE ACCOUNT)
    const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
      },
      // Usamos apenas readonly por segurança, já que essa rota só lista arquivos
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 📂 3. BUSCA OS ARQUIVOS DA PASTA SOLICITADA
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, webViewLink, iconLink)",
      orderBy: "folder, name",
      supportsAllDrives: true, 
      includeItemsFromAllDrives: true,
    });

    return NextResponse.json({ files: response.data.files });

  } catch (error: any) {
    console.error("Erro ao listar Drive via Robô:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}