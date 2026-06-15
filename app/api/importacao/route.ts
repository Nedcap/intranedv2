import { NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

const SPREADSHEET_ID = "1uJ_BysO5VW6DLxoDuoy2ZKzEtRBcptydAa87Ih8cRCw";

async function getGoogleSheetsClient() {
  const credentialsPath = path.join(process.cwd(), "credentials.json");
  const tokenPath = path.join(process.cwd(), "token.json");

  const credsFile = await fs.readFile(credentialsPath, "utf-8");
  const creds = JSON.parse(credsFile);
  const { client_secret, client_id, redirect_uris } = creds.installed || creds.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const tokenFile = await fs.readFile(tokenPath, "utf-8");
  oAuth2Client.setCredentials(JSON.parse(tokenFile));

  return google.sheets({ version: "v4", auth: oAuth2Client });
}

function limparNome(texto: any): string {
  if (!texto) return "";
  let n = String(texto).toUpperCase().trim();
  n = n.replace(/^\d+\s*-\s*/, ""); 
  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  n = n.replace(/[^A-Z0-9\s]/g, " "); 
  n = n.replace(/\b(LTDA|SA|S A|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, ""); 
  return n.replace(/\s+/g, " ").trim();
}

async function sincronizarRisco(sheets: any, novosDadosSec: any, novosDadosFidc: any) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "BASE_CARTEIRA!A:G" });
  const rows = res.data.values || [];
  const carteira: Record<string, any> = {};
  
  if (rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawCed = String(row[0] || "").trim();
      const chave = limparNome(rawCed);
      if (!chave) continue;
      carteira[chave] = {
        cedente: rawCed,
        riscoSec: parseFloat(row[1]) || 0,
        riscoFidc: parseFloat(row[2]) || 0,
        vencidoSec: parseFloat(row[4]) || 0,
        vencidoFidc: parseFloat(row[5]) || 0,
      };
    }
  }

  if (novosDadosSec) {
    Object.keys(carteira).forEach(c => { carteira[c].riscoSec = 0; carteira[c].vencidoSec = 0; });
    Object.entries(novosDadosSec).forEach(([c, d]: any) => {
      if (!carteira[c]) carteira[c] = { cedente: d.cedenteOriginal, riscoSec: 0, riscoFidc: 0, vencidoSec: 0, vencidoFidc: 0 };
      carteira[c].riscoSec = d.risco;
      carteira[c].vencidoSec = d.vencido;
    });
  }

  if (novosDadosFidc) {
    Object.keys(carteira).forEach(c => { carteira[c].riscoFidc = 0; carteira[c].vencidoFidc = 0; });
    Object.entries(novosDadosFidc).forEach(([c, d]: any) => {
      if (!carteira[c]) carteira[c] = { cedente: d.cedenteOriginal, riscoSec: 0, riscoFidc: 0, vencidoSec: 0, vencidoFidc: 0 };
      carteira[c].riscoFidc = d.risco;
      carteira[c].vencidoFidc = d.vencido;
    });
  }

  const nomesOrdenados = Object.keys(carteira).sort((a, b) => b.length - a.length);
  const mappingMaiorNome: Record<string, string> = {};
  nomesOrdenados.forEach(curto => {
    for (const longo of nomesOrdenados) {
      if (longo.length > curto.length && longo.startsWith(curto)) {
        mappingMaiorNome[curto] = longo;
        break;
      }
    }
  });

  const carteiraHarmonizada: Record<string, any> = {};
  Object.entries(carteira).forEach(([c, d]: any) => {
    const chaveFinal = mappingMaiorNome[c] || c;
    const nomeExibicao = carteira[chaveFinal]?.cedente || d.cedente;
    if (!carteiraHarmonizada[chaveFinal]) {
      carteiraHarmonizada[chaveFinal] = { cedente: nomeExibicao, riscoSec: 0, riscoFidc: 0, vencidoSec: 0, vencidoFidc: 0 };
    }
    carteiraHarmonizada[chaveFinal].riscoSec += d.riscoSec;
    carteiraHarmonizada[chaveFinal].riscoFidc += d.riscoFidc;
    carteiraHarmonizada[chaveFinal].vencidoSec += d.vencidoSec;
    carteiraHarmonizada[chaveFinal].vencidoFidc += d.vencidoFidc;
  });

  const linesFinal: any[][] = [];
  Object.values(carteiraHarmonizada).forEach((d: any) => {
    const rTotal = d.riscoSec + d.riscoFidc;
    const vTotal = d.vencidoSec + d.vencidoFidc;
    if (rTotal > 0 || vTotal > 0) {
      linesFinal.push([d.cedente, d.riscoSec, d.riscoFidc, rTotal, d.vencidoSec, d.vencidoFidc, vTotal]);
    }
  });

  linesFinal.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "BASE_CARTEIRA!A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "BASE_CARTEIRA!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Cedente", "Risco Sec", "Risco FIDC", "Risco Total", "Vencido Sec", "Vencido FIDC", "Vencido Total"], ...linesFinal]
    }
  });
}

async function sincronizarVop(sheets: any, lancSec: any[] | null, lancFidc: any[] | null) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "LANCAMENTOS_VOP!A:E" });
  const rows = res.data.values || [];
  const consolidado: Record<string, any> = {};
  const limparColunaSec = lancSec !== null;
  const limparColunaFidc = lancFidc !== null;

  if (rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dataOp = String(row[0] || "").trim();
      const mesAno = String(row[1] || "").trim();
      const rawCed = String(row[2] || "").trim();
      const vSec = limparColunaSec ? 0 : (parseFloat(row[3]) || 0);
      const vFidc = limparColunaFidc ? 0 : (parseFloat(row[4]) || 0);

      if (!mesAno || !rawCed) continue;
      if (vSec > 0 || vFidc > 0) {
        const chave = `${mesAno}|||${rawCed}`;
        consolidado[chave] = { data: dataOp, mesAno, cedente: rawCed, vSec, vFidc };
      }
    }
  }

  if (lancSec) {
    lancSec.forEach((d: any) => {
      const chave = `${d.mesAno}|||${d.cedenteOriginal}`;
      if (!consolidado[chave]) consolidado[chave] = { data: d.dataOp, mesAno: d.mesAno, cedente: d.cedenteOriginal, vSec: 0, vFidc: 0 };
      consolidado[chave].vSec += d.vopSec;
    });
  }

  if (lancFidc) {
    lancFidc.forEach((d: any) => {
      const chave = `${d.mesAno}|||${d.cedenteOriginal}`;
      if (!consolidado[chave]) consolidado[chave] = { data: d.dataOp, mesAno: d.mesAno, cedente: d.cedenteOriginal, vSec: 0, vFidc: 0 };
      consolidado[chave].vFidc += d.vopFidc;
    });
  }

  const linesFinal: any[][] = Object.values(consolidado)
    .filter((d: any) => d.vSec > 0 || d.vFidc > 0)
    .map((d: any) => [d.data, d.mesAno, d.cedente, d.vSec, d.vFidc]);

  linesFinal.sort((a, b) => {
    const pA = a[1].split('/'), pB = b[1].split('/');
    return `${pA[1] || ''}-${pA[0] || ''}`.localeCompare(`${pB[1] || ''}-${pB[0] || ''}`) || String(a[2]).localeCompare(String(b[2]));
  });

  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "LANCAMENTOS_VOP!A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "LANCAMENTOS_VOP!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["Data da Operação", "Mes/Ano", "Cedente", "Vop Sec", "Vop FIDC"], ...linesFinal] }
  });
}

async function sincronizarReceitas(sheets: any, lancRec: any[] | null, lancJur: any[] | null, empresaTipo: "SEC" | "FIDC") {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "RECEITAS!A:F" });
  const rows = res.data.values || [];
  const consolidado: Record<string, any> = {};

  if (rows.length > 1) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const emp = String(row[0] || "").toUpperCase().trim();
      const dataOp = String(row[1] || "").trim().replace("'", "");
      const rawCed = String(row[2] || "").trim();
      let des = parseFloat(row[3]) || 0;
      let tar = parseFloat(row[4]) || 0;
      let jur = parseFloat(row[5]) || 0;

      if (!emp || !dataOp || !rawCed) continue;

      if (emp === empresaTipo) {
        if (lancRec !== null) { des = 0; tar = 0; }
        if (lancJur !== null) jur = 0;
      }

      if (des > 0 || tar > 0 || jur > 0) {
        const chave = `${emp}|||${dataOp}|||${rawCed}`;
        consolidado[chave] = { emp, dataOp, cedente: rawCed, desagio: des, tarifas: tar, juros: jur };
      }
    }
  }

  if (lancRec) {
    lancRec.forEach((d: any) => {
      const chave = `${empresaTipo}|||${d.dataOp}|||${d.cedenteOriginal}`;
      if (!consolidado[chave]) consolidado[chave] = { emp: empresaTipo, dataOp: d.dataOp, cedente: d.cedenteOriginal, desagio: 0, tarifas: 0, juros: 0 };
      consolidado[chave].desagio += d.desagio;
      consolidado[chave].tarifas += d.tarifas;
    });
  }

  if (lancJur) {
    lancJur.forEach((d: any) => {
      const chave = `${empresaTipo}|||${d.dataOp}|||${d.cedenteOriginal}`;
      if (!consolidado[chave]) consolidado[chave] = { emp: empresaTipo, dataOp: d.dataOp, cedente: d.cedenteOriginal, desagio: 0, tarifas: 0, juros: 0 };
      consolidado[chave].juros += d.juros;
    });
  }

  const linesFinal: any[][] = Object.values(consolidado)
    .filter((d: any) => d.desagio > 0 || d.tarifas > 0 || d.juros > 0)
    .map((d: any) => [d.emp, `'${d.dataOp}`, d.cedente, d.desagio, d.tarifas, d.juros]);

  linesFinal.sort((a, b) => {
    const pA = a[1].replace("'", "").split('/'), pB = b[1].replace("'", "").split('/');
    return String(a[0]).localeCompare(String(b[0])) || 
           `${pA[2] || ''}-${pA[1] || ''}-${pA[0] || ''}`.localeCompare(`${pB[2] || ''}-${pB[1] || ''}-${pB[0] || ''}`) || 
           String(a[2]).localeCompare(String(b[2]));
  });

  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "RECEITAS!A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "RECEITAS!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["Empresa", "Data", "Cedente", "Deságio", "Tarifas", "Juros e Multa"], ...linesFinal] }
  });
}

async function sincronizarCarteiraSec(sheets: any, dadosCarteiraSec: any[]) {
  const linhasFinais = dadosCarteiraSec.map(d => [
    d.cedente, d.sacado, d.numeroTitulo, d.vencimento, d.valorFace, d.valorAberto, d.status
  ]);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "CARTEIRA_SEC!A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "CARTEIRA_SEC!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Cedente", "Sacado", "Numero Titulo", "Vencimento", "Valor Face", "Valor Aberto", "Status"], ...linhasFinais]
    }
  });
}

async function sincronizarCarteiraFidc(sheets: any, dadosCarteiraFidc: any[]) {
  const linhasFinais = dadosCarteiraFidc.map(d => [
    d.cedente, d.sacado, d.vencimento, d.valorFace, d.valorAberto, d.status
  ]);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "CARTEIRA_FIDC!A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "CARTEIRA_FIDC!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Cedente", "Sacado", "Vencimento", "Valor Face", "Valor Aberto", "Status"], ...linhasFinais]
    }
  });
}

// 🌐 O NOVO GATILHO 'GET' ADICIONADO PARA ENVIAR OS DADOS PARA A TELA DE CARTEIRA!
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "CARTEIRA_SEC!A:Z";
    
    const sheets = await getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    
    return NextResponse.json({ values: res.data.values || [] });
  } catch (error: any) {
    return NextResponse.json({ values: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const sheets = await getGoogleSheetsClient();

    if (payload.risco?.sec || payload.risco?.fidc) {
      await sincronizarRisco(sheets, payload.risco.sec, payload.risco.fidc);
    }

    const temVopSec = payload.vop?.sec && payload.vop.sec.length > 0;
    const temVopFidc = payload.vop?.fidc && payload.vop.fidc.length > 0;
    if (temVopSec || temVopFidc) {
      await sincronizarVop(sheets, temVopSec ? payload.vop.sec : null, temVopFidc ? payload.vop.fidc : null);
    }

    const temRecSec = payload.receitas?.sec && payload.receitas.sec.length > 0;
    const temJurSec = payload.juros?.sec && payload.juros.sec.length > 0;
    if (temRecSec || temJurSec) {
      await sincronizarReceitas(sheets, temRecSec ? payload.receitas.sec : null, temJurSec ? payload.juros.sec : null, "SEC");
    }

    const temRecFidc = payload.receitas?.fidc && payload.receitas.fidc.length > 0;
    if (temRecFidc) {
      await sincronizarReceitas(sheets, payload.receitas.fidc, null, "FIDC");
    }

    if (payload.carteira?.sec && payload.carteira.sec.length > 0) {
      await sincronizarCarteiraSec(sheets, payload.carteira.sec);
    }
    if (payload.carteira?.fidc && payload.carteira.fidc.length > 0) {
      await sincronizarCarteiraFidc(sheets, payload.carteira.fidc);
    }

    return NextResponse.json({ success: true, message: "Sincronização concluída!" });
  } catch (error: any) {
    console.error("ERRO NA API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}