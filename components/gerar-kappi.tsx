/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

// ============================================================================
// 1. MOTOR DE LEITURA E PARSING INTELIGENTE DO EXCEL KAPPI
// ============================================================================
export const lerExcelKappi = async (file: File) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const result: any = {};

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
    
    let headerRowIndex = -1;
    let maxCols = 0;
    
    // O Kappi esconde os cabeçalhos no meio da planilha. Vamos caçá-los nas primeiras 30 linhas:
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
       const row = rows[i];
       if (!row) continue;
       const colCount = row.filter((cell) => cell !== null && cell !== "").length;
       const rowStr = row.join(" ").toLowerCase();
       
       if (rowStr.includes("documento") || rowStr.includes("razão social") || rowStr.includes("alerta") || rowStr.includes("status")) {
           if (colCount > maxCols) {
               maxCols = colCount;
               headerRowIndex = i;
           }
       }
    }

    if (headerRowIndex !== -1 && rows.length > headerRowIndex + 1) {
       const headers = rows[headerRowIndex].map((h) => String(h || "").trim());
       const tableData = [];
       for (let i = headerRowIndex + 1; i < rows.length; i++) {
           const row = rows[i];
           if (!row || row.filter((c) => c !== null && c !== "").length === 0) continue;
           
           const obj: any = {};
           let hasData = false;
           headers.forEach((head, idx) => {
               if (head) {
                   obj[head] = row[idx] !== undefined ? row[idx] : null;
                   if (obj[head] !== null && obj[head] !== "") hasData = true;
               }
           });
           if (hasData) tableData.push(obj);
       }
       result[sheetName] = tableData;
    } else {
       result[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    }
  });

  return result;
};

// ============================================================================
// 2. TRANSFORMADOR HTML (O DOSSIÊ EXECUTIVO)
// ============================================================================
export const gerarHtmlKappi = async (kappiData: any, nomeArquivo: string) => {
  if (!kappiData) return "";

  const painelAlertas = kappiData['Painel de Alertas'] || [];
  const documentoPrincipal = painelAlertas.find((r: any) => String(r['Tipo'] || '').includes('Principal'));
  const nomePrincipal = documentoPrincipal ? documentoPrincipal['Nome/Razão Social'] : 'DOSSIÊ DE BACKGROUND CHECK';
  
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
        <td style="font-weight: bold; font-size: 11px;">${r['Nome/Razão Social'] || '-'}</td>
        <td style="font-size: 10px; color: var(--slate-500);">${r['Tipo'] || '-'}</td>
        <td style="text-align: center;"><span class="badge ${critico > 0 ? 'badge-critico' : 'badge-ok'}">${critico}</span></td>
        <td style="text-align: center;"><span class="badge ${medio > 0 ? 'badge-medio' : 'badge-ok'}">${medio}</span></td>
        <td style="text-align: center; font-weight: bold; color: var(--emerald-600);">${conf}</td>
     </tr>`;
  }).join('');

  // ⚖️ PROCESSOS JUDICIAIS
  const processSheets = Object.keys(kappiData).filter(k => k.includes('Processo Judicia'));
  const todosProcessos = processSheets.flatMap(sheet => kappiData[sheet]);
  
  const processosPorEntidade: Record<string, any[]> = {};
  todosProcessos.forEach((p: any) => {
     const doc = String(p['Documento'] || '').replace(/\D/g, '');
     if (!doc) return;
     if (!processosPorEntidade[doc]) processosPorEntidade[doc] = [];
     processosPorEntidade[doc].push(p);
  });

  let htmlJudicial = '';
  Object.keys(processosPorEntidade).forEach(doc => {
      const procList = processosPorEntidade[doc];
      const nomeEntidade = docToName[doc] || 'Entidade Desconhecida';
      
      const ativos: any[] = [];
      const suspensos: any[] = [];
      const encerrados: any[] = [];

      procList.forEach((p: any) => {
          const status = String(p['Status'] || p['Status do Processo'] || '').toLowerCase();
          if (!status || status === 'undefined' || status === 'null') return;
          
          if (status.includes('tramit') || status.includes('recurso') || status.includes('execu')) ativos.push(p);
          else if (status.includes('suspen') || status.includes('sobrest') || status.includes('provis')) suspensos.push(p);
          else if (status.includes('arquiv') || status.includes('baix') || status.includes('extint') || status.includes('conform')) encerrados.push(p);
          else {
              if (String(p['Possui Alerta']).toLowerCase() === 'sim') ativos.push(p);
              else encerrados.push(p);
          }
      });

      htmlJudicial += `
      <div class="card" style="border-left: 4px solid var(--slate-800); margin-bottom: 1.5rem;">
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--slate-200); padding-bottom: 12px; margin-bottom: 12px;">
            <strong style="font-size: 13px; text-transform: uppercase;">${nomeEntidade}</strong>
            <div style="display: flex; gap: 6px;">
               <span class="badge" style="background: var(--rose-100); color: var(--rose-700);">🔴 ${ativos.length} ATIVOS</span>
               <span class="badge" style="background: var(--amber-100); color: var(--amber-700);">🟡 ${suspensos.length} SUSP</span>
               <span class="badge" style="background: var(--emerald-100); color: var(--emerald-700);">🟢 ${encerrados.length} ENC</span>
            </div>
         </div>
         
         ${ativos.length > 0 ? `
           <div style="font-weight: 800; color: var(--rose-700); font-size: 10px; text-transform: uppercase; margin-bottom: 8px;">Processos Ativos Mapeados:</div>
           <div class="table-wrap" style="margin-bottom: 0;">
              <table>
                 <thead>
                   <tr><th>Classe / Área</th><th>Assunto Principal</th><th>Valor da Causa</th><th>Data Distr.</th></tr>
                 </thead>
                 <tbody>
                   ${ativos.map(a => `
                     <tr>
                        <td><strong>${a['Classe de Processo'] || a['Classe'] || '-'}</strong><br><span style="font-size: 9px; color: var(--slate-500);">${a['Área'] || '-'}</span></td>
                        <td style="font-size: 11px;">${a['Assuntos'] || a['Assunto'] || '-'}</td>
                        <td style="font-family: monospace; font-weight: bold; color: var(--rose-600);">${a['Valor da Causa'] ? 'R$ ' + a['Valor da Causa'] : '-'}</td>
                        <td style="font-size: 11px; text-align: center;">${a['Data de Distribuição'] || a['Data'] || '-'}</td>
                     </tr>
                   `).join('')}
                 </tbody>
              </table>
           </div>
         ` : `<p style="font-size: 11px; color: var(--emerald-600); font-weight: bold; margin: 0;">✅ Ficha limpa de ações ativas e críticas na base.</p>`}
      </div>
      `;
  });

  // ⚠️ OUTROS ALERTAS DINÂMICOS (Varre as 30 abas)
  let htmlOutrosAlertas = '';
  const skipSheets = ['Painel de Alertas', 'Lista de Alertas por Documento'];

  Object.keys(kappiData).forEach(sheetName => {
      if (skipSheets.includes(sheetName) || sheetName.includes('Processo Judicia')) return;

      const rows = kappiData[sheetName];
      const alertRows = rows.filter((r: any) => {
         const alerta = String(r['Alerta'] || r['Possui Alerta'] || r['Possui apontamento?'] || '').toLowerCase().trim();
         return alerta && alerta !== 'undefined' && alerta !== 'em conformidade' && alerta !== 'não' && alerta !== 'nao' && alerta !== 'nada consta';
      });

      if (alertRows.length > 0) {
          const allKeys = Object.keys(alertRows[0]);
          const keysToSkip = ['Documento', 'Alerta', 'Possui Alerta', 'Possui apontamento?'];
          const displayKeys = allKeys.filter(k => !keysToSkip.includes(k)).slice(0, 5); // Pega as 5 colunas mais importantes pra caber na tela

          htmlOutrosAlertas += `
          <div class="card" style="border-left: 4px solid var(--amber-500); margin-bottom: 1.5rem;">
              <h3 style="margin-top: 0; color: var(--slate-800); text-transform: uppercase; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                 <span style="font-size: 16px;">⚠️</span> ${sheetName.replace(/P[FJ]-/, '')}
              </h3>
              <div class="table-wrap" style="margin-bottom: 0;">
                  <table>
                     <thead>
                        <tr>
                           <th>Entidade Envolvida</th>
                           ${displayKeys.map(k => `<th>${k}</th>`).join('')}
                        </tr>
                     </thead>
                     <tbody>
                        ${alertRows.map((r: any) => {
                            const doc = String(r['Documento'] || '').replace(/\D/g, '');
                            const nome = docToName[doc] || r['Documento'] || 'Desconhecido';
                            return `
                            <tr>
                               <td style="font-weight: bold; color: var(--slate-800); font-size: 11px;">${nome}</td>
                               ${displayKeys.map(k => `<td style="font-size: 11px;">${r[k] || '-'}</td>`).join('')}
                            </tr>`;
                        }).join('')}
                     </tbody>
                  </table>
              </div>
          </div>
          `;
      }
  });

  const dataAtualStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // 📝 MONTAGEM FINAL DO HTML
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <title>Dossiê Background Check Kappi</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
      <style>
          :root {
              --slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0; --slate-500: #64748b; 
              --slate-600: #475569; --slate-800: #1e293b; --slate-900: #0f172a;
              --blue-600: #2563eb; --blue-900: #1e3a8a;
              --emerald-50: #ecfdf5; --emerald-100: #d1fae5; --emerald-600: #059669; --emerald-700: #047857;
              --amber-50: #fffbeb; --amber-100: #fef3c7; --amber-600: #d97706; --amber-700: #b45309;
              --rose-50: #fff1f2; --rose-100: #ffe4e6; --rose-600: #e11d48; --rose-700: #be123c;
          }
          body { font-family: 'Inter', sans-serif; background: var(--slate-50); color: var(--slate-800); margin: 0; padding: 2rem; font-size: 12px; }
          .container { max-width: 1100px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid var(--slate-200); }
          .header { background: var(--slate-900); color: white; padding: 2.5rem; border-radius: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { margin: 0; font-size: 1.6rem; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.2; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 9px; text-transform: uppercase; }
          .badge-critico { background: var(--rose-100); color: var(--rose-700); border: 1px solid var(--rose-200); }
          .badge-medio { background: var(--amber-100); color: var(--amber-700); border: 1px solid var(--amber-200); }
          .badge-ok { background: var(--emerald-100); color: var(--emerald-700); border: 1px solid var(--emerald-200); }
          .table-wrap { overflow-x: auto; margin-bottom: 2rem; border-radius: 0.5rem; border: 1px solid var(--slate-200); background: white; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th, td { padding: 10px 12px; border-bottom: 1px solid var(--slate-200); }
          th { background: var(--slate-100); color: var(--slate-600); font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
          .card { background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 0.5rem; padding: 1.25rem; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
          .kpi-box { padding: 1.5rem; border-radius: 0.75rem; text-align: center; border: 1px solid var(--slate-200); background: white; }
          h2.section-title { font-size: 14px; text-transform: uppercase; font-weight: 900; color: var(--slate-900); margin: 2.5rem 0 1rem 0; padding-bottom: 8px; border-bottom: 2px solid var(--slate-100); display: flex; align-items: center; gap: 8px; }
          @media print { 
              body { padding: 0; background: white; } 
              .container { border: none; box-shadow: none; padding: 0; max-width: 100%; } 
              .header { background: white; color: black; border: 2px solid black; }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <div>
                  <div style="font-size: 10px; font-weight: bold; color: var(--slate-400); margin-bottom: 6px; letter-spacing: 1px;">Dossiê Consolidado Kappi / Intraned</div>
                  <h1>${nomePrincipal}</h1>
                  <div style="margin-top: 10px; font-size: 11px; color: var(--slate-300);"><strong>Arquivo Origem:</strong> ${nomeArquivo} &nbsp;|&nbsp; <strong>Data do Report:</strong> ${dataAtualStr}</div>
              </div>
          </div>

          <div class="kpi-grid">
              <div class="kpi-box">
                  <div style="font-size: 10px; font-weight: bold; color: var(--slate-500); text-transform: uppercase;">Entidades Checadas</div>
                  <div style="font-size: 2rem; font-weight: 900; color: var(--slate-800);">${painelAlertas.length}</div>
              </div>
              <div class="kpi-box" style="border-bottom: 4px solid var(--rose-500);">
                  <div style="font-size: 10px; font-weight: bold; color: var(--rose-700); text-transform: uppercase;">Alertas Críticos</div>
                  <div style="font-size: 2rem; font-weight: 900; color: var(--rose-600);">${totalCritico}</div>
              </div>
              <div class="kpi-box" style="border-bottom: 4px solid var(--amber-500);">
                  <div style="font-size: 10px; font-weight: bold; color: var(--amber-700); text-transform: uppercase;">Alertas Médios</div>
                  <div style="font-size: 2rem; font-weight: 900; color: var(--amber-600);">${totalMedio}</div>
              </div>
              <div class="kpi-box" style="border-bottom: 4px solid var(--emerald-500);">
                  <div style="font-size: 10px; font-weight: bold; color: var(--emerald-700); text-transform: uppercase;">Em Conformidade</div>
                  <div style="font-size: 2rem; font-weight: 900; color: var(--emerald-600);">${totalConformidade}</div>
              </div>
          </div>

          <h2 class="section-title"><span>🛡️</span> 1. Painel Resumo de Entidades</h2>
          <div class="table-wrap">
              <table>
                  <thead>
                     <tr><th>Nome / Razão Social</th><th>Vínculo</th><th style="text-align:center;">Crítico</th><th style="text-align:center;">Médio</th><th style="text-align:center;">Conformidade</th></tr>
                  </thead>
                  <tbody>${resumoLinhas}</tbody>
              </table>
          </div>

          <h2 class="section-title"><span>⚖️</span> 2. Auditoria de Processos Judiciais</h2>
          ${htmlJudicial || '<p style="color: var(--slate-500); font-style: italic;">Nenhum detalhamento processual contido nesta planilha.</p>'}

          ${htmlOutrosAlertas ? `
             <h2 class="section-title" style="page-break-before: always;"><span>🚨</span> 3. Alertas Restritivos e Mídias Mapeadas</h2>
             ${htmlOutrosAlertas}
          ` : ''}

          <div style="margin-top: 3rem; text-align: center; font-size: 10px; color: var(--slate-400); border-top: 1px solid var(--slate-200); padding-top: 1rem;">
             Relatório gerado automaticamente pela plataforma. Confidencial e de uso restrito ao Comitê de Crédito.
          </div>
      </div>
  </body>
  </html>
  `;
};

// ============================================================================
// 3. COMPONENTE REACT DE INTERFACE (O VIEWER / UPLOADER)
// ============================================================================
export default function GerarKappiViewer() {
  const [file, setFile] = useState<File | null>(null);
  const [gerando, setGerando] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const gerarDossieKappi = async () => {
    if (!file) return;
    setGerando(true);
    try {
      // 1. Converte o Excel para JSON Estruturado
      const dataJson = await lerExcelKappi(file);
      
      // 2. Converte o JSON para o HTML do Dossiê
      const htmlContent = await gerarHtmlKappi(dataJson, file.name);
      
      // 3. Abre em uma nova aba pronta pra impressão
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      
    } catch (error) {
      console.error(error);
      alert("❌ Falha ao processar e transformar a planilha do Kappi.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
      <h3 className="font-bold text-slate-800 uppercase text-sm tracking-wider flex items-center gap-2">
        <span>🕵️‍♂️</span> Visualizador Avançado Kappi
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Faça o upload da planilha bruta extraída do Kappi. O sistema irá consolidar as dezenas de abas, agrupar os passivos judiciais e destacar apenas as restrições relevantes em um Dossiê HTML limpo para a Mesa de Crédito.
      </p>
      
      <input 
        type="file" 
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors cursor-pointer"
      />

      <button 
        onClick={gerarDossieKappi}
        disabled={!file || gerando}
        className="bg-slate-900 hover:bg-black text-white font-bold px-4 py-3 rounded-lg text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
      >
        {gerando ? (
           <><span className="animate-spin text-base">⏳</span> Processando Planilha...</>
        ) : (
           <>🖨️ Gerar Dossiê Executivo (HTML)</>
        )}
      </button>
    </div>
  );
}