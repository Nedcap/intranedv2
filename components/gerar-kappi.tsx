/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

// ============================================================================
// 1. MOTOR DE LEITURA E PARSING INTELIGENTE DO EXCEL KAPPI (100% DOS DADOS)
// ============================================================================
export const lerExcelKappi = async (fileOrBuffer: File | ArrayBuffer) => {
  const data = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const workbook = XLSX.read(data, { type: "array" });
  const result: any = {};

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    // Pegamos as linhas brutas (array de arrays) para localizar onde o cabeçalho realmente começa
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
    
    let headerRowIndex = 0;
    let maxCols = 0;
    
    // O Kappi varia muito onde começa a tabela. A linha com mais células preenchidas nas primeiras 30 linhas é o cabeçalho.
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
       const row = rows[i];
       if (!row) continue;
       const colCount = row.filter((cell) => cell !== null && cell !== "").length;
       if (colCount > maxCols) {
           maxCols = colCount;
           headerRowIndex = i;
       }
    }

    if (maxCols > 0 && rows.length > headerRowIndex + 1) {
       const headers = rows[headerRowIndex].map((h) => String(h || "").trim());
       const tableData = [];
       
       for (let i = headerRowIndex + 1; i < rows.length; i++) {
           const row = rows[i];
           if (!row || row.filter((c) => c !== null && c !== "").length === 0) continue;
           
           const obj: any = {};
           let hasData = false;
           headers.forEach((head, idx) => {
               if (head) {
                   obj[head] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
                   if (obj[head] !== "") hasData = true;
               }
           });
           if (hasData) tableData.push(obj);
       }
       result[sheetName] = tableData;
    } else {
       // Fallback caso a aba seja bizarra
       result[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }
  });

  return result;
};

// Formatação Segura para Moedas (caso a coluna pareça dinheiro)
const formatarValor = (val: any) => {
  if (typeof val === 'number') {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  }
  return String(val).replace(/\n/g, '<br/>');
};

// ============================================================================
// 2. TRANSFORMADOR HTML (ESTÉTICA "DOSSIÊ NED")
// ============================================================================
export const gerarHtmlKappi = async (kappiData: any, nomeArquivo: string) => {
  if (!kappiData) return "";

  const painelAlertas = kappiData['Painel de Alertas'] || [];
  const documentoPrincipal = painelAlertas.find((r: any) => String(r['Tipo'] || '').includes('Principal'));
  const nomePrincipal = documentoPrincipal ? documentoPrincipal['Nome/Razão Social'] : 'DOSSIÊ BACKGROUND CHECK (KAPPI)';
  const docPrincipalCnpj = documentoPrincipal ? documentoPrincipal['Documento da Diligência'] : '';
  const dataAtualStr = new Date().toLocaleDateString('pt-BR');

  // Dicionário para traduzir CNPJ/CPF em Nomes nas tabelas dinâmicas
  const docToName: Record<string, string> = {};
  painelAlertas.forEach((r: any) => {
      const doc = String(r['Documento da Diligência'] || r['Documento'] || '').replace(/\D/g, '');
      if (doc) docToName[doc] = r['Nome/Razão Social'] || 'Entidade Desconhecida';
  });

  // KPIs
  let totalCritico = 0, totalMedio = 0, totalConformidade = 0;
  const resumoLinhas = painelAlertas.map((r: any) => {
     const critico = Number(r['Crítico']) || 0;
     const medio = Number(r['Médio']) || 0;
     const conf = Number(r['Em conformidade']) || 0;
     
     totalCritico += critico;
     totalMedio += medio;
     totalConformidade += conf;

     return `
     <tr>
        <td style="font-weight: 700; color: var(--text);">${r['Nome/Razão Social'] || '-'}</td>
        <td style="color: var(--muted);">${r['Tipo'] || '-'}</td>
        <td class="text-center"><span class="badge ${critico > 0 ? 'badge-critico' : 'badge-ok'}">${critico}</span></td>
        <td class="text-center"><span class="badge ${medio > 0 ? 'badge-medio' : 'badge-ok'}">${medio}</span></td>
        <td class="text-center font-bold" style="color: var(--green);">${conf}</td>
     </tr>`;
  }).join('');

  // ⚖️ 1. PROCESSOS JUDICIAIS 
  const processSheets = Object.keys(kappiData).filter(k => k.includes('Processo Judicia'));
  const todosProcessos = processSheets.flatMap(sheet => kappiData[sheet]);
  
  const processosPorEntidade: Record<string, any[]> = {};
  todosProcessos.forEach((p: any) => {
     const doc = String(p['Documento'] || p['Partes Passivas'] || '').replace(/\D/g, '').substring(0, 14); // Tenta achar o doc
     const chave = doc || 'Mapeamento Geral';
     if (!processosPorEntidade[chave]) processosPorEntidade[chave] = [];
     processosPorEntidade[chave].push(p);
  });

  let htmlJudicial = '';
  Object.keys(processosPorEntidade).forEach(chaveDoc => {
      const procList = processosPorEntidade[chaveDoc];
      const nomeEntidade = docToName[chaveDoc] || (chaveDoc === 'Mapeamento Geral' ? 'Consolidado de Ações' : chaveDoc);
      
      const ativos: any[] = [];
      const suspensos: any[] = [];
      const encerrados: any[] = [];

      procList.forEach((p: any) => {
          const status = String(p['Status'] || p['Status do Processo'] || '').toLowerCase();
          if (!status || status === 'undefined' || status === 'null') { encerrados.push(p); return; }
          
          if (status.includes('tramit') || status.includes('recurso') || status.includes('execu')) ativos.push(p);
          else if (status.includes('suspen') || status.includes('sobrest') || status.includes('provis')) suspensos.push(p);
          else if (status.includes('arquiv') || status.includes('baix') || status.includes('extint') || status.includes('conform')) encerrados.push(p);
          else ativos.push(p); // Na dúvida, é ativo
      });

      htmlJudicial += `
      <div class="card" style="margin-bottom: 1.5rem;">
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 12px;">
            <strong style="font-size: 1.05rem; text-transform: uppercase; color: var(--blue-dark);">${nomeEntidade}</strong>
            <div style="display: flex; gap: 6px;">
               <span class="badge badge-critico">🔴 ${ativos.length} ATIVOS</span>
               <span class="badge badge-medio">🟡 ${suspensos.length} SUSP.</span>
               <span class="badge badge-ok">🟢 ${encerrados.length} ENC.</span>
            </div>
         </div>
         
         ${ativos.length > 0 ? `
           <div style="font-weight: 800; color: var(--red); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 8px;">Ações Ativas (Detalhamento):</div>
           <div class="table-wrap" style="margin-bottom: 0;">
              <table>
                 <thead>
                   <tr>
                     <th>Classe / Área</th>
                     <th>Assunto Principal</th>
                     <th>Status / Situação</th>
                     <th class="text-right">Valor da Causa</th>
                     <th>Órgão Julgador</th>
                     <th class="text-center">Data</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${ativos.map(a => `
                     <tr>
                        <td><strong style="color: var(--text);">${a['Classe de Processo'] || a['Classe'] || '-'}</strong><br><span style="font-size: 0.8rem; color: var(--muted);">${a['Área'] || '-'}</span></td>
                        <td>${a['Assuntos'] || a['Assunto'] || '-'}</td>
                        <td style="font-weight: bold; color: var(--red);">${a['Status'] || '-'}</td>
                        <td class="text-right font-mono font-bold" style="color: var(--blue-dark);">${formatarValor(a['Valor da Causa'] || a['Valor'])}</td>
                        <td style="font-size: 0.85rem;">${a['Órgão Julgador'] || a['Tribunal'] || '-'}</td>
                        <td class="text-center font-mono" style="font-size: 0.85rem;">${a['Data de Distribuição'] || a['Data'] || '-'}</td>
                     </tr>
                   `).join('')}
                 </tbody>
              </table>
           </div>
         ` : `<p style="font-size: 0.9rem; color: var(--green); font-weight: bold; margin: 0;">✅ Nenhuma ação pendente ou ativa localizada para este CNPJ/CPF.</p>`}
      </div>
      `;
  });

  // ⚠️ 2. TODAS AS OUTRAS ABAS (100% DE LEITURA E RENDERIZAÇÃO)
  let htmlOutrasAbas = '';
  const abasIgnoradas = ['Painel de Alertas', 'Lista de Alertas por Documento'];

  Object.keys(kappiData).forEach(sheetName => {
      // Pula os que já renderizamos
      if (abasIgnoradas.includes(sheetName) || sheetName.includes('Processo Judicia')) return;

      const rows = kappiData[sheetName];
      if (!rows || rows.length === 0) return;

      // Pega TODAS as chaves (colunas) existentes nesta aba
      const allKeys = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r))));
      // Remove colunas inúteis ou sujas
      const validKeys = allKeys.filter(k => k !== 'Documento' && k.trim() !== '' && !k.startsWith('__EMPTY'));

      htmlOutrasAbas += `
      <h2 style="font-size: 1.15rem; color: var(--blue-dark); margin-top: 2rem;">📄 ${sheetName.replace(/P[FJ]-/, '')}</h2>
      <div class="table-wrap">
          <table style="min-width: max-content;">
              <thead>
                  <tr>
                      ${validKeys.map(k => `<th>${k}</th>`).join('')}
                  </tr>
              </thead>
              <tbody>
                  ${rows.map((r: any) => `
                      <tr>
                          ${validKeys.map(k => `<td style="font-size: 0.85rem; max-width: 300px; white-space: normal; word-wrap: break-word;">${r[k] !== null && r[k] !== "" ? formatarValor(r[k]) : '-'}</td>`).join('')}
                      </tr>
                  `).join('')}
              </tbody>
          </table>
      </div>
      `;
  });

  // 📝 MONTAGEM FINAL DO HTML (Usando 100% o CSS do Dossiê Ned)
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dossiê Background Check - ${nomePrincipal}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
          :root { 
              --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; 
              --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; 
              --green: #16a34a; --red: #dc2626; --yellow: #ca8a04;
              --rose-100: #ffe4e6; --rose-200: #fecdd3; --rose-700: #be123c;
              --amber-100: #fef3c7; --amber-200: #fde68a; --amber-700: #b45309;
              --emerald-100: #d1fae5; --emerald-200: #a7f3d0; --emerald-700: #047857;
          }
          body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 2rem; font-size: 13px; line-height: 1.5; }
          .container { max-width: 1300px; margin: 0 auto; background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid var(--border); }
          .header { background: linear-gradient(135deg, var(--slate-900), var(--slate-800)); color: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3); margin-bottom: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
          .header h1 { margin: 0; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; line-height: 1.1; font-size: 2.2rem;}
          .header .meta { font-size: 0.95rem; opacity: 0.9; font-weight: 500; font-family: monospace;}
          
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
          .kpi-box { padding: 1.5rem; border-radius: 0.75rem; text-align: center; border: 1px solid var(--border); background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);}
          .kpi-label { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.5rem; }
          .kpi-val { font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; }

          h2 { font-size: 1.35rem; font-weight: 900; color: var(--blue-dark); margin: 3rem 0 1.5rem 0; display: flex; align-items: center; gap: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.75rem;}
          h2::before { content: ""; display: inline-block; width: 6px; height: 1.35rem; background-color: var(--blue); border-radius: 4px; }
          
          .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
          .table-wrap { overflow-x: auto; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 1.5rem; }
          .table-wrap::-webkit-scrollbar { height: 8px; }
          .table-wrap::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
          .table-wrap::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th, td { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); vertical-align: middle;}
          th { background: #f8fafc; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; white-space: nowrap; position: sticky; top: 0; z-index: 10;}
          tr:hover { background: #f1f5f9; }
          
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: monospace; }
          
          .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 10px; text-transform: uppercase; white-space: nowrap; }
          .badge-critico { background: var(--rose-100); color: var(--rose-700); border: 1px solid var(--rose-200); }
          .badge-medio { background: var(--amber-100); color: var(--amber-700); border: 1px solid var(--amber-200); }
          .badge-ok { background: var(--emerald-100); color: var(--emerald-700); border: 1px solid var(--emerald-200); }
          
          @media print { 
              body { padding: 0; background: white; font-size: 10px;} 
              .container { border: none; box-shadow: none; padding: 0; max-width: 100%; } 
              .header { background: white; color: black; border: 2px solid black; box-shadow: none; padding: 1.5rem;}
              .header h1 { color: black; }
              .header .meta { color: black; border-top: 1px solid black; }
              .card, .table-wrap { border: 1px solid black !important; box-shadow: none !important; }
              .table-wrap { overflow-x: visible; }
              th, td { padding: 6px; }
              h2 { color: black; border-bottom-color: black;}
              h2::before { background-color: black; }
          }
      </style>
  </head>
  <body>

  <div class="container">
      <div class="header">
          <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; opacity: 0.9;">Relatório de Auditoria Kappi</div>
              <h1>${nomePrincipal}</h1>
              <div class="meta">${docPrincipalCnpj ? `CNPJ/CPF: ${docPrincipalCnpj}` : 'Base Oficial'}</div>
              
              <div class="meta" style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.2);">
                  <strong style="color:#fff;">Arquivo Matriz:</strong> ${nomeArquivo} &nbsp;|&nbsp; 
                  <strong style="color:#fff;">Data Extração:</strong> ${dataAtualStr}
              </div>
          </div>
      </div>

      <div class="kpi-grid">
          <div class="kpi-box">
              <div class="kpi-label">Entidades Checadas</div>
              <div class="kpi-val" style="color: var(--blue-dark);">${painelAlertas.length}</div>
          </div>
          <div class="kpi-box" style="border-bottom: 4px solid var(--red);">
              <div class="kpi-label" style="color: var(--red);">Alertas Críticos</div>
              <div class="kpi-val" style="color: var(--red);">${totalCritico}</div>
          </div>
          <div class="kpi-box" style="border-bottom: 4px solid var(--yellow);">
              <div class="kpi-label" style="color: var(--yellow);">Alertas Médios</div>
              <div class="kpi-val" style="color: var(--yellow);">${totalMedio}</div>
          </div>
          <div class="kpi-box" style="border-bottom: 4px solid var(--green);">
              <div class="kpi-label" style="color: var(--green);">Em Conformidade</div>
              <div class="kpi-val" style="color: var(--green);">${totalConformidade}</div>
          </div>
      </div>

      <h2>1. Painel Resumo e Conformidade</h2>
      <div class="table-wrap">
          <table>
              <thead>
                 <tr><th>Nome / Razão Social</th><th>Vínculo / Papel</th><th class="text-center">Crítico</th><th class="text-center">Médio</th><th class="text-center">Conformidade</th></tr>
              </thead>
              <tbody>${resumoLinhas}</tbody>
          </table>
      </div>

      <h2>2. Auditoria e Varredura Processual</h2>
      ${htmlJudicial || '<div class="card"><p style="color: var(--muted); font-style: italic; font-weight: bold; text-align: center; margin: 0;">Nenhum detalhamento de processos judiciais encontrado na matriz.</p></div>'}

      <h2 style="page-break-before: always;">3. Relatório Integral: Mídias, Sanções e Restritivos</h2>
      <p style="font-size: 0.95rem; color: var(--muted); margin-bottom: 1.5rem;">As tabelas abaixo refletem <strong>todas</strong> as pesquisas realizadas na matriz oficial, mapeando dados fiscais, trabalhistas, ambientais, mídias e cadastrais.</p>
      
      ${htmlOutrasAbas || '<div class="card"><p style="color: var(--muted); text-align: center; margin: 0;">Nenhuma outra aba de dados encontrada.</p></div>'}

      <div style="margin-top: 4rem; text-align: center; font-size: 0.85rem; color: var(--muted); border-top: 1px solid var(--border); padding-top: 1.5rem;">
         Relatório renderizado e estruturado via Engine V8 Intraned. Uso exclusivo e restrito ao Comitê Executivo de Crédito.
      </div>
  </div>

  </body>
  </html>
  `;
};

// ============================================================================
// 3. COMPONENTE REACT DE INTERFACE (AUTO VIEWER EMBED)
// ============================================================================
export default function GerarKappiViewer({ urlsDocumentos }: { urlsDocumentos?: string[] }) {
  const [htmlKappiRenderizado, setHtmlKappiRenderizado] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const puxarEProcessarPlanilha = async () => {
      if (!urlsDocumentos || urlsDocumentos.length === 0) {
        setCarregando(false);
        setErro("Nenhum documento anexado à esta análise.");
        return;
      }

      // Procura a URL que seja uma planilha do Excel
      const urlKappi = urlsDocumentos.find(url => url.toLowerCase().includes('.xlsx') || url.toLowerCase().includes('.xls'));

      if (!urlKappi) {
        setCarregando(false);
        setErro("Nenhuma planilha do Kappi (.xlsx) localizada nos anexos.");
        return;
      }

      try {
        setCarregando(true);
        // Baixa o arquivo em formato ArrayBuffer
        const response = await fetch(urlKappi);
        if (!response.ok) throw new Error("Falha ao baixar o arquivo da nuvem R2.");
        const buffer = await response.arrayBuffer();

        // Faz o parse do Excel 100%
        const dataJson = await lerExcelKappi(buffer);
        
        // Monta o HTML Absoluto
        let nomeLimpo = "Planilha_Kappi.xlsx";
        try {
          const partes = urlKappi.split('/');
          nomeLimpo = decodeURIComponent(partes[partes.length - 1].split('?')[0]);
        } catch(e) {}

        const html = await gerarHtmlKappi(dataJson, nomeLimpo);
        setHtmlKappiRenderizado(html);
        setCarregando(false);

      } catch (err: any) {
        console.error(err);
        setErro("Falha ao compilar a planilha do Kappi. O arquivo pode estar corrompido ou o navegador bloqueou o download (CORS).");
        setCarregando(false);
      }
    };

    puxarEProcessarPlanilha();
  }, [urlsDocumentos]);

  if (carregando) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 italic text-xs gap-3 font-mono border border-slate-200 rounded-2xl">
        <span className="animate-spin text-2xl">⏳</span>
        Compilando Matriz Completa do Kappi...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 italic text-xs gap-3 font-mono border border-slate-200 rounded-2xl p-6 text-center">
        <span className="text-3xl">⚠️</span>
        {erro}
        <br/><br/>
        O visualizador necessita de um arquivo <b>.xlsx</b> anexado junto aos documentos base da empresa para gerar a auditoria completa.
      </div>
    );
  }

  return (
    <iframe 
      srcDoc={htmlKappiRenderizado} 
      className="w-full h-full border-0 bg-white rounded-2xl" 
      sandbox="allow-scripts allow-same-origin" 
    />
  );
}