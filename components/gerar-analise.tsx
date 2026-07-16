/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

// Formatação segura (exportada caso precise em outro lugar)
export const formatarMoeda = (valor: any) => {
  const num = Number(valor);
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

// ============================================================================
// MOTOR CENTRAL DO DOSSIÊ HTML (Exportado para ser usado no Comitê)
// ============================================================================
export const gerarHtmlDossie = async (item: any) => {
  if (!item) return "";
  
  // Unifica a leitura: Se for do Banco (Comitê), vem dentro de dados_consolidados. Se for do form, já é direto.
  const analise = item.dados_consolidados || item;
  
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const empresaNome = item.empresa_nome || analise.razao_social || 'EMPRESA NÃO INFORMADA';
  const cnpjDoc = item.cnpj || analise.cnpj || '-';
  
  const localizacaoReal = analise.localizacao?.trim() || "Brasil";
  const enderecoQuery = encodeURIComponent(localizacaoReal);

  let siteTratado = analise.site?.trim() || "";
  if (siteTratado && !siteTratado.startsWith('http')) siteTratado = 'https://' + siteTratado;

  // ==========================================
  // CABEÇALHO: PROPONENTES
  // ==========================================
  const renderizarCabecalhoEmpresas = () => {
    if (analise.empresas_principais && analise.empresas_principais.length > 0) {
      return `
        <div>
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; opacity: 0.9;">Proponentes:</div>
          ${analise.empresas_principais.map((emp: any) => `
            <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">${emp.razao_social || 'EMPRESA NÃO INFORMADA'}</h1>
            <div class="meta" style="font-family: monospace; font-size: 0.95rem; margin-bottom: 1rem;">CNPJ: ${emp.cnpj || 'Não informado'}</div>
          `).join('')}
        </div>
      `;
    }
    return `
      <div>
        <h1 style="font-size: 2.2rem; margin-bottom: 0.2rem;">${empresaNome}</h1>
        <div class="meta" style="font-family: monospace; font-size: 1rem;">CNPJ: ${cnpjDoc}</div>
      </div>
    `;
  };

  let totalLimites = 0;
  const propostasRows = analise.propostas && analise.propostas.length > 0 
    ? analise.propostas.map((p: any) => {
        totalLimites += Number(p.limite) || 0;
        return `
        <tr>
            <td style="font-weight:700; color: var(--text);">${p.modalidade || '-'}</td>
            <td class="text-right font-bold" style="color:var(--blue-dark); font-size: 1.1rem;">${formatarMoeda(p.limite)}</td>
            <td class="text-center">${p.prazo || '-'}</td>
            <td class="text-center">${p.tranche || '-'}</td>
            <td class="text-center font-bold" style="background:#f8fafc;">${p.taxa || '-'}</td>
            <td>${p.garantia || '-'}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" class="text-center" style="color:var(--muted); padding: 1.5rem;">Nenhuma proposta informada.</td></tr>`;

  const empresasRows = analise.empresas_grupo && analise.empresas_grupo.length > 0 
    ? analise.empresas_grupo.map((e: any) => `
      <tr>
          <td style="font-weight:600; font-size:0.9rem;">${e.empresa || '-'}</td>
          <td style="font-size:0.9rem;" class="font-mono">${e.cnpj || '-'}</td>
          <td style="font-size:0.9rem; text-align:center;">${e.fundacao || '-'}</td>
          <td style="font-size:0.9rem; text-align:center; font-weight: 600;">${e.idade || '-'}</td>
      </tr>`).join("") 
    : `<tr><td colspan="4" class="text-center" style="color:var(--muted); padding: 1.5rem;">Nenhuma empresa coligada mapeada.</td></tr>`;

  const socioRows = analise.socios && analise.socios.length > 0 
    ? analise.socios.map((s: any) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 10px; font-weight: 700; color: var(--text);">${s.nome || '-'}</td>
          <td style="padding: 12px 10px; color: var(--muted); text-align:center;">${s.funcao || 'Sócio'}</td>
          <td style="padding: 12px 10px; color: var(--muted); text-align:center;">
            ${s.figure_contrato === 'Sim' ? '<span style="color:var(--green); font-weight:bold;">✅ Assina</span>' : '❌ Não Assina'}
          </td>
          <td style="padding: 12px 10px; text-align: right; font-weight: 800; color: var(--blue-dark);" class="font-mono">${s.perc || 0}%</td>
      </tr>`).join("") 
    : `<tr><td colspan="4" style="color:var(--muted); text-align:center; padding: 1.5rem;">Nenhum sócio informado.</td></tr>`;

  let totalPatrimonio = 0;
  const patrimonioRows = analise.patrimonios && analise.patrimonios.length > 0 
    ? analise.patrimonios.map((p: any) => {
        totalPatrimonio += Number(p.valor) || 0;
        return `
          <tr>
            <td style="font-weight:600;">${p.descricao || '-'} <br><span style="font-weight:normal; font-size: 0.8rem; color:var(--muted);">Titular: ${p.socio || 'Sócio'}</span></td>
            <td class="text-right font-bold font-mono text-green-700" style="font-size: 1.1rem; vertical-align: middle;">${formatarMoeda(p.valor)}</td>
          </tr>`;
      }).join("")
    : ``;

  let totalBancosDet = 0;
  let curtoPrazo = 0, longoPrazo = 0;
  const bancoRows = analise.endividamento_detalhado && analise.endividamento_detalhado.length > 0 
    ? analise.endividamento_detalhado.map((b: any) => {
        const v = Number(b.saldo) || 0;
        totalBancosDet += v;
        if (b.prazo === "Curto Prazo") curtoPrazo += v; else longoPrazo += v;
        return `
        <tr>
            <td style="font-weight:700; font-size:0.9rem;">${b.instituicao || '-'}</td>
            <td style="font-size:0.9rem;">
              ${b.modalidade || '-'} <br>
              <span style="color:var(--muted); font-size:10px; font-weight: 600; text-transform: uppercase;">${b.tipo} | ${b.prazo}</span>
            </td>
            <td class="text-right font-bold font-mono" style="font-size:1rem; color:var(--red); vertical-align: middle;">${formatarMoeda(v)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="3" class="text-center" style="color:var(--muted); padding: 1.5rem;">Nenhuma linha de endividamento localizada.</td></tr>`;

  let totalRestritivos = 0, qtdRestritivos = 0;
  const restritivosRows = analise.restritivos && analise.restritivos.length > 0 
    ? analise.restritivos.map((r: any) => {
        totalRestritivos += Number(r.valor) || 0;
        qtdRestritivos += Number(r.qtd) || 1;
        return `
        <tr>
            <td style="font-weight:600;">${r.empresa_socio || '-'}</td>
            <td style="color:var(--yellow); font-weight:bold;">${r.restritivo || '-'}</td>
            <td class="text-center font-mono font-bold" style="background:#f8fafc;">${r.qtd || 1}</td>
            <td class="text-right font-bold font-mono text-red-600">${formatarMoeda(r.valor)}</td>
        </tr>`;
    }).join("") : ``;

  const refRows = analise.referencias && analise.referencias.length > 0
    ? analise.referencias.map((r: any) => {
        const calcLiq5 = (Number(r.liquidez_pontual) || 0) + (Number(r.atraso_5_dias) || 0);
        return `
        <tr>
          <td style="font-weight:700;">${r.instituicao || '-'}</td>
          <td class="text-center font-mono" style="font-size: 0.8rem; color: var(--muted);">${r.ultima_operacao ? new Date(r.ultima_operacao).toLocaleDateString('pt-BR') : '-'}</td>
          <td class="text-right font-bold font-mono text-slate-700">${formatarMoeda(r.vop)}</td>
          <td class="text-right font-bold font-mono" style="color: var(--blue);">${formatarMoeda(r.limite_global)}</td>
          <td class="text-right">
             <div style="font-weight:bold; color:var(--red); font-family: monospace; font-size: 1rem;">${formatarMoeda(r.risco_total)}</div>
             ${r.risco_1 || r.risco_2 ? `<div style="font-size:0.7rem; color:var(--muted); margin-top:2px;">R1: ${formatarMoeda(r.risco_1)} | R2: ${formatarMoeda(r.risco_2)}</div>` : ''}
          </td>
          <td class="text-center" style="font-size:11px; font-weight: 600; background: #f8fafc;">
            Pt: ${r.liquidez_pontual || 0}% <br>
            5d: <span style="color:var(--blue-dark); font-weight:bold;">${calcLiq5}%</span> | 15d+: ${r.atraso_15_dias || 0}%
          </td>
          <td class="text-center font-mono font-bold">${r.concentracao || 0}%</td>
        </tr>`
      }).join("")
    : `<tr><td colspan="7" class="text-center" style="color:var(--muted); padding: 1.5rem;">Nenhuma referência mapeada.</td></tr>`;

  const clientesRows = analise.clientes && analise.clientes.length > 0 ? analise.clientes.map((c: any) => `<li>${c.nome || c}</li>`).join("") : "Não informado";
  const fornecedoresRows = analise.fornecedores && analise.fornecedores.length > 0 ? analise.fornecedores.map((f: any) => `<li>${f.nome || f}</li>`).join("") : "Não informado";
  const concorrentesRows = analise.concorrentes && analise.concorrentes.length > 0 ? analise.concorrentes.map((c: any) => `<li>${c.nome || c}</li>`).join("") : "Não informado";

  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const calcTotAno = (ano: string) => meses.reduce((acc, m) => acc + Number(analise.dados_faturamento?.[ano]?.[m] || 0), 0);
  const mesesPreenchidosGeral = (ano: string) => meses.filter(m => Number(analise.dados_faturamento?.[ano]?.[m] || 0) > 0).length;
  
  const calcMediaGeralAno = (ano: string) => { 
      const pre = mesesPreenchidosGeral(ano); 
      if (pre === 0) return 0;
      return calcTotAno(ano) / (ano === "2026" ? pre : 12); 
  };

  const totAno26 = calcTotAno("2026");
  const totAno25 = calcTotAno("2025");
  const totAno24 = calcTotAno("2024");
  
  const varTot26_25 = totAno25 > 0 ? ((totAno26 - totAno25) / totAno25) * 100 : 0;
  const varTot25_24 = totAno24 > 0 ? ((totAno25 - totAno24) / totAno24) * 100 : 0;

  const medGeral26 = calcMediaGeralAno("2026");
  const medGeral25 = calcMediaGeralAno("2025");
  const medGeral24 = calcMediaGeralAno("2024");
  
  const varMedGeral26_25 = medGeral25 > 0 ? ((medGeral26 - medGeral25) / medGeral25) * 100 : 0;
  const varMedGeral25_24 = medGeral24 > 0 ? ((medGeral25 - medGeral24) / medGeral24) * 100 : 0;

  const fatRows = meses.map(mes => {
    const val2024 = Number(analise.dados_faturamento?.["2024"]?.[mes]) || 0;
    const val2025 = Number(analise.dados_faturamento?.["2025"]?.[mes]) || 0;
    const val2026 = Number(analise.dados_faturamento?.["2026"]?.[mes]) || 0;

    const delta1 = val2024 > 0 ? ((val2025 - val2024) / val2024) * 100 : 0;
    const delta2 = val2025 > 0 ? ((val2026 - val2025) / val2025) * 100 : 0;
    
    return `
    <tr>
        <td style="font-weight: 700; text-transform: uppercase; color: var(--text);">${mes}</td>
        <td class="text-center font-mono font-bold" style="color: var(--blue-dark);">${formatarMoeda(val2026)}</td>
        <td class="text-center font-mono ${delta2 > 0 ? 'delta-pos' : delta2 < 0 ? 'delta-neg' : ''}">${delta2 !== 0 ? delta2.toFixed(1) + '%' : '-'}</td>
        <td class="text-center font-mono">${formatarMoeda(val2025)}</td>
        <td class="text-center font-mono ${delta1 > 0 ? 'delta-pos' : delta1 < 0 ? 'delta-neg' : ''}">${delta1 !== 0 ? delta1.toFixed(1) + '%' : '-'}</td>
        <td class="text-center font-mono" style="color: var(--muted);">${formatarMoeda(val2024)}</td>
    </tr>`;
  }).join("");

  const faturamentoReferencia = medGeral26 > 0 ? medGeral26 : (medGeral25 > 0 ? medGeral25 : medGeral24);
  const alavancagem = faturamentoReferencia > 0 ? (totalBancosDet / faturamentoReferencia).toFixed(2) : "0.00";

  const arrayFat2024 = JSON.stringify(meses.map(m => analise.dados_faturamento?.["2024"]?.[m] || 0));
  const arrayFat2025 = JSON.stringify(meses.map(m => analise.dados_faturamento?.["2025"]?.[m] || 0));
  const arrayFat2026 = JSON.stringify(meses.map(m => analise.dados_faturamento?.["2026"]?.[m] || 0));

  const endividamentoValido = analise.endividamento_detalhado ? analise.endividamento_detalhado.filter((e:any) => e.saldo > 0) : [];
  const chartEndivData = endividamentoValido.reduce((acc: any, d: any) => {
    const mod = d.modalidade || "Outros";
    acc[mod] = (acc[mod] || 0) + Number(d.saldo || 0);
    return acc;
  }, {});
  const arrayEndivLabels = JSON.stringify(Object.keys(chartEndivData || {}));
  const arrayEndivData = JSON.stringify(Object.values(chartEndivData || {}));

  // Imagens do R2
  let fotosUnicas: string[] = [];
  if (item.todas_as_imagens_r2 && Array.isArray(item.todas_as_imagens_r2)) {
    fotosUnicas = item.todas_as_imagens_r2;
  } else {
    // Processamento das imagens caso não venha no objeto (uso direto do formulário)
    let prefixoPasta = `clientes/${analise.id || item.id}/`; 
    const imagensMapeadas = new Set<string>();

    if (analise.dados_documentos && analise.dados_documentos.length > 0) {
      try {
        const urlBase = new URL(analise.dados_documentos[0]);
        const parts = urlBase.pathname.split('/'); 
        const idxClientes = parts.indexOf('clientes');
        if (idxClientes !== -1 && parts.length > idxClientes + 1) {
          prefixoPasta = `${parts[idxClientes]}/${parts[idxClientes + 1]}/`;
        }
      } catch(e) {}
    }

    try {
      const resR2 = await fetch('/api/listar-r2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: prefixoPasta }) });
      if (resR2.ok) {
        const dataR2 = await resR2.json();
        const regexImagem = /\.(jpeg|jpg|gif|png|webp)/i;
        if (dataR2.urls) dataR2.urls.forEach((url: string) => { if (regexImagem.test(url)) imagensMapeadas.add(url); });
      }
    } catch (err) {}

    const normalizarUrl = (u: any) => { if (typeof u !== 'string') return null; if (/\.(jpeg|jpg|gif|png|webp)/i.test(u)) return u.trim(); return null; };
    if (analise.anexos?.todas_as_imagens) analise.anexos.todas_as_imagens.forEach((u: string) => { const url = normalizarUrl(u); if(url) imagensMapeadas.add(url); });
    if (analise.anexos?.fachada_url) { const f = normalizarUrl(analise.anexos.fachada_url); if(f) imagensMapeadas.add(f); }
    if (analise.anexos?.fotos_visita_url) { const v = normalizarUrl(analise.anexos.fotos_visita_url); if(v) imagensMapeadas.add(v); }
    if (analise.galeria_urls) analise.galeria_urls.forEach((u: string) => { const url = normalizarUrl(u); if(url) imagensMapeadas.add(url); });
    if (Array.isArray(analise.dados_documentos)) analise.dados_documentos.forEach((u: string) => { const url = normalizarUrl(u); if(url) imagensMapeadas.add(url); });

    fotosUnicas = Array.from(imagensMapeadas);
  }

  const galeriaHTML = fotosUnicas.length > 0 
    ? `
    <div class="print-break"></div>
    <h2 style="margin-top: 3.5rem;">📸 Galeria de Fotos e Evidências (${fotosUnicas.length})</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 2.5rem; width: 100%;">
        ${fotosUnicas.map(url => `
            <div class="card hover-card" style="padding: 0.5rem; display: flex; justify-content: center; align-items: center; background: #f8fafc; overflow: hidden;">
                <img src="${url}" style="width: 100%; min-width: 100%; max-width: 100%; height: 250px; object-fit: cover; border-radius: 0.5rem;" alt="Evidência Fotográfica">
            </div>
        `).join("")}
    </div>
    ` : '';

  const normalizarOrganogramaUrl = (u: any) => { if (typeof u !== 'string') return null; if (/\.(jpeg|jpg|gif|png|webp)/i.test(u)) return u.trim(); return null; };
  const organogramaUrlTratado = normalizarOrganogramaUrl(analise.anexos?.organograma_url);

  // Retorna a string HTML montada perfeitamente
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dossiê Executivo - ${empresaNome}</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
          :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; }
          body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 2rem; font-size: 13px; line-height: 1.5; }
          .container { max-width: 1200px; margin: 0 auto; background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid var(--border); }
          .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 10px 30px -5px rgba(37, 99, 235, 0.3); margin-bottom: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; align-items: flex-start; }
          @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: stretch; } }
          .header h1 { margin: 0; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; line-height: 1.1;}
          .header .meta { font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem; font-weight: 500; }
          .badge-top { background: rgba(255,255,255,0.2); padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem; backdrop-filter: blur(8px); text-transform: uppercase; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap; text-align: center; width: 100%; box-sizing: border-box;}
          h2 { font-size: 1.35rem; font-weight: 900; color: var(--blue-dark); margin: 3rem 0 1.5rem 0; display: flex; align-items: center; gap: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.75rem;}
          h2::before { content: ""; display: inline-block; width: 6px; height: 1.35rem; background-color: var(--blue); border-radius: 4px; }
          .grid-2, .grid-3 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
          @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } }
          .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
          .metric-label { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.5rem; }
          .metric-value { font-size: 1.7rem; font-weight: 900; color: var(--text); letter-spacing: -0.5px; }
          .table-wrap { overflow-x: auto; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th, td { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
          th { background: #f8fafc; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
          tr:hover { background: #f1f5f9; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .delta-pos { color: var(--green); font-weight: 800; background: #f0fdf4; }
          .delta-neg { color: var(--red); font-weight: 800; background: #fef2f2; }
          .row-total td { background: #f8fafc; font-weight: 800; font-size: 0.95rem; border-top: 2px solid var(--border); }
          .chart-container { position: relative; height: 300px; width: 100%; }
          .parecer-wrapper { background: white; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); overflow: hidden; position: relative; margin-bottom: 2rem;}
          .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--blue); }
          .parecer-header { background: #f8fafc; padding: 1rem 1.5rem; font-weight: 900; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 1.05rem; letter-spacing: 0.5px;}
          .parecer-body { padding: 1.5rem; font-size: 1rem; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word; text-align: justify;}
          .parecer-footer { background: #f8fafc; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; color: var(--muted); font-size: 0.85rem; font-weight: 700; text-align: right;}
          .btn-maps { background: var(--blue); color: white; padding: 12px 20px; border-radius: 0.5rem; text-decoration: none; font-size: 0.85rem; font-weight: 800; display: inline-block; transition: 0.2s; box-shadow: 0 4px 6px rgba(37,99,235,0.2); border: 1px solid rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
          .btn-maps:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(37,99,235,0.3); }
          .org-container { width: 100%; height: 500px; border-radius: 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; }
          ul.simple-list { margin: 0; padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.6; color: var(--text); font-weight: 500;}
          .hover-card { transition: box-shadow 0.3s, transform 0.3s; }
          .hover-card:hover { box-shadow: 0 15px 30px -5px rgba(0,0,0,0.1); transform: translateY(-2px); }
          .expandable-box { position: relative; max-height: 120px; overflow: hidden; transition: max-height 0.6s ease-in-out; }
          .expandable-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 50px; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1) 90%); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; font-size: 0.75rem; font-weight: 800; color: var(--blue); transition: opacity 0.3s; }
          .expandable-fade::after { content: "Passar o mouse para expandir ▼"; }
          .hover-card:hover .expandable-box { max-height: 2000px; }
          .hover-card:hover .expandable-fade { opacity: 0; pointer-events: none; }
          @media print { 
              .print-break { page-break-before: always; } 
              body { background: white; padding: 0; } 
              .container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
              .card, .table-wrap, .parecer-wrapper { box-shadow: none !important; border: 1px solid #cbd5e1 !important; transform: none !important; } 
              .header { padding: 1.5rem; color: black; background: white; border: 2px solid black; } 
              .header .meta, .header .badge-top { color: black; background: transparent; border-color: black; } 
              .expandable-box { max-height: none !important; }
              .expandable-fade { display: none !important; }
              h2 { color: black; border-bottom: 2px solid black; }
              h2::before { background-color: black; }
          }
      </style>
  </head>
  <body>

  <div class="container">
      <div class="header">
          <div style="flex-grow: 1;">
              ${renderizarCabecalhoEmpresas()}
              <div class="meta" style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.95rem;">
                  <strong style="color:#fff;">Data Emissão:</strong> ${dataAtual} &nbsp;|&nbsp; 
                  <strong style="color:#fff;">Analista:</strong> ${analise.analista || item.comercial || '-'} &nbsp;|&nbsp; 
                  <strong style="color:#fff;">Gerente:</strong> ${analise.gerente || '-'}
              </div>
          </div>
          <div style="display:flex; flex-direction:column; gap: 12px; align-items:flex-end; min-width: 280px;">
              <div class="badge-top" style="background: rgba(0,0,0,0.2);">
                  RATING: <span style="color: #fde047;">${analise.rating || 'N/A'}</span>
              </div>
              <div class="badge-top" style="background: white; color: var(--blue-dark);">
                  RECOMENDAÇÃO DO ANALISTA: ${analise.recomendacao_analista || 'EM ANÁLISE'}
              </div>
          </div>
      </div>

      <div class="grid-3" style="margin-bottom: 2rem;">
          <div class="card" style="grid-column: span 3; border-left: 4px solid var(--blue);">
              <div class="metric-label" style="margin-bottom: 0.75rem;">Súmula Comercial (Resumo da Visita)</div>
              <div style="font-size: 1.05rem; color: #334155; line-height: 1.7; text-align: justify; white-space: pre-wrap;">${analise.resumo_visita || 'Nenhum resumo comercial preenchido na plataforma.'}</div>
          </div>
      </div>

      ${analise.parecer_executivo ? `
      <!-- 🔥 BLOCO INJETADO PELA IA MOTOR V8 -->
      <div class="card hover-card" style="margin-bottom: 2rem; border-top: 4px solid var(--blue); background: #f4f7ff;">
          <div style="font-weight: 900; font-size: 1rem; color: var(--blue-dark); text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>🧠</span> Súmula Executiva de Crédito (Parecer Motor IA V8)
          </div>
          <div style="font-size: 0.95rem; color: #1e293b; line-height: 1.7; white-space: pre-wrap; text-align: justify;">${analise.parecer_executivo}</div>
      </div>
      ` : ''}

      <h2>1. Estrutura Pleiteada (Condições Comerciais)</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Modalidade</th><th class="text-right">Limite</th><th class="text-center">Prazo Médio</th><th class="text-center">Tranche</th><th class="text-center">Taxa Base</th><th>Garantia Adicional</th></tr></thead>
              <tbody>
                  ${propostasRows}
                  ${totalLimites > 0 ? `
                  <tr class="row-total">
                      <td style="color: var(--blue-dark);">LIMITE TOTAL SOLICITADO</td>
                      <td class="text-right font-mono" style="color:var(--blue-dark); font-size: 1.15rem;">${formatarMoeda(totalLimites)}</td>
                      <td colspan="4"></td>
                  </tr>` : ''}
              </tbody>
          </table>
      </div>

      <h2>2. Panorama Societário e Background da Empresa</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Empresa (Grupo Coligado)</th><th>CNPJ</th><th class="text-center">Data Fundação</th><th class="text-center">Tempo Mercado</th></tr></thead>
              <tbody>
                  ${empresasRows}
              </tbody>
          </table>
      </div>

      <div class="grid-2">
          <div class="card" style="margin-bottom:0; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div class="metric-label">Localização Oficial & Atividade Principal</div>
                <div style="font-weight: 800; font-size: 1rem; color: var(--text); margin-bottom: 0.5rem;">${analise.localizacao || '-'}</div>
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--muted);">${analise.ramo || '-'}</div>
              </div>
              <div style="font-size:0.85rem; color:var(--muted); margin-top:1.5rem; padding-top:1.5rem; border-top: 1px solid var(--border);">
                  Balanço Auditado: <strong>${analise.balanco_auditado || 'Não'}</strong> <br>
                  Consultoria de Gestão: <strong>${analise.consultoria_gestao || 'Não'}</strong>
              </div>
          </div>
          <div class="card" style="margin-bottom:0; padding: 0;">
              <div style="padding: 1.5rem 1.5rem 0.5rem 1.5rem;" class="metric-label">Quadro Societário Atual</div>
              <table style="width:100%; font-size: 0.85rem; border-collapse: collapse;">
                  ${socioRows}
              </table>
              <div style="font-size:0.85rem; color:var(--muted); padding: 1.25rem 1.5rem; background: #f8fafc; border-top: 1px solid var(--border); border-radius: 0 0 0.75rem 0.75rem;">
                  Regra de Assinatura: <strong style="color: var(--text);">${analise.regra_assinatura || '-'}</strong> <br> 
                  Aval Societário Coletado: <strong style="color: var(--text);">${analise.aval_societario || '-'}</strong>
              </div>
          </div>
      </div>

      <div class="grid-2" style="margin-top: 1.5rem;">
          <div class="card hover-card" style="padding:0; overflow:hidden; position:relative; border: 1px solid var(--border);">
              <div style="position:absolute; top:12px; left:12px; background:rgba(255,255,255,0.95); padding:8px 16px; border-radius:8px; font-size:0.75rem; font-weight:900; z-index:10; box-shadow: 0 4px 10px rgba(0,0,0,0.1); color: var(--blue-dark); text-transform: uppercase;">Visão Satélite</div>
              <iframe width="100%" height="320" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${enderecoQuery}&t=k&z=18&output=embed" allowfullscreen></iframe>
          </div>
          
          <div class="card" style="padding: 2.5rem; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#f8fafc; text-align: center;">
              <div style="font-size: 3.5rem; margin-bottom: 1rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">📍</div>
              <div style="font-weight: 900; color: var(--blue-dark); margin-bottom: 0.75rem; font-size: 1.35rem; text-transform: uppercase;">Mapeamento Geográfico</div>
              <div style="font-size: 1rem; color: var(--text); font-weight: 500; margin-bottom: 2.5rem; max-width: 90%; line-height: 1.6;">${localizacaoReal}</div>
              
              <div style="display: flex; gap: 1rem; width: 100%; justify-content: center; flex-wrap: wrap;">
                  <a href="https://www.google.com/maps/search/?api=1&query=${enderecoQuery}" target="_blank" class="btn-maps">🗺️ Abrir Mapa</a>
                  <a href="https://www.google.com/maps?q=${enderecoQuery}&layer=c" target="_blank" class="btn-maps" style="background: var(--green);">🚶‍♂️ Ver Fachada (Street View)</a>
              </div>
          </div>
      </div>

      ${siteTratado ? `
      <!-- 🔥 NOVO BLOCO: SCREENSHOT DO SITE (Usando API Mshots Automattic) -->
      <div class="card hover-card" style="margin-top: 1.5rem; padding: 0; overflow: hidden; height: 380px; position: relative; border: 1px solid var(--border); display: flex; justify-content: center; align-items: center; background: #f1f5f9;">
          <div style="position:absolute; top:12px; left:12px; background:rgba(255,255,255,0.95); padding:8px 16px; border-radius:8px; font-size:0.75rem; font-weight:900; z-index:10; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-transform: uppercase;">
              <a href="${siteTratado}" target="_blank" style="text-decoration: none; color: var(--blue-dark);">🌐 Acessar Site Oficial ↗</a>
          </div>
          <img src="https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteTratado)}?w=1200&h=800" style="width: 100%; height: 100%; object-fit: cover; object-position: top;" alt="Preview do Site" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'12\\' fill=\\'%2364748b\\'>Prévia do site indisponível no momento.</text></svg>'; this.style.objectFit='none';">
      </div>
      ` : ''}

      ${analise.clientes || analise.fornecedores || analise.concorrentes ? `
      <div class="grid-3" style="margin-top: 1.5rem;">
          <div class="card">
              <div class="metric-label">Principais Clientes</div>
              <ul class="simple-list">${clientesRows}</ul>
          </div>
          <div class="card">
              <div class="metric-label">Principais Fornecedores</div>
              <ul class="simple-list">${fornecedoresRows}</ul>
          </div>
          <div class="card">
              <div class="metric-label">Principais Concorrentes</div>
              <ul class="simple-list">${concorrentesRows}</ul>
          </div>
      </div>
      ` : ''}

      <h2 style="margin-top: 3.5rem;">3. Organograma Estrutural / Teia</h2>
      <div style="margin-bottom: 2.5rem;">
          ${analise.organograma_json && analise.organograma_json.nodes && analise.organograma_json.nodes.length > 0 ? `
          <div class="card hover-card" style="padding:1rem;">
              <div id="network-container" class="org-container"></div>
          </div>
          ` : organogramaUrlTratado ? `
          <div class="card hover-card" style="padding: 1.5rem; display:flex; justify-content:center; background: #f8fafc;">
              <img src="${organogramaUrlTratado}" style="max-width: 100%; max-height: 600px; object-fit: contain; border-radius: 0.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
          </div>
          ` : `
          <div class="card" style="display:flex; justify-content:center; align-items:center; height:150px; color:var(--muted); font-weight:700; background: #f8fafc; border: 1px dashed #cbd5e1; font-size: 1rem;">[NENHUMA TEIA SOCIETÁRIA ANEXADA]</div>
          `}
      </div>

      ${galeriaHTML}

      ${totalPatrimonio > 0 ? `
      <h3 style="color: var(--blue-dark); text-transform: uppercase; font-size: 1rem; font-weight: 900; margin-top: 2.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.75rem;">Patrimônio de Garantia (Bens Declarados IRPF)</h3>
      <div class="table-wrap">
          <table>
              <tbody>
                  ${patrimonioRows}
                  <tr class="row-total">
                      <td>MONTA GLOBAL PATRIMONIAL</td>
                      <td class="text-right font-mono" style="color:var(--green); font-size: 1.15rem;">${formatarMoeda(totalPatrimonio)}</td>
                  </tr>
              </tbody>
          </table>
      </div>
      ` : ''}

      <div class="print-break"></div>

      <h2>4. Evolução do Faturamento & Performance</h2>
      <div class="card hover-card" style="margin-bottom: 2rem; padding: 2rem;">
          <div class="metric-label" style="margin-bottom: 1.5rem;">Comparativo Histórico Anual (YoY)</div>
          <div class="chart-container"><canvas id="fatChart"></canvas></div>
      </div>
      
      <div class="table-wrap">
          <table>
              <thead>
                  <tr>
                      <th>Período</th>
                      <th class="text-center">Ciclo 2026 (R$)</th>
                      <th class="text-center">Var YoY (%)</th>
                      <th class="text-center">Ciclo 2025 (R$)</th>
                      <th class="text-center">Var YoY (%)</th>
                      <th class="text-center">Ciclo 2024 (R$)</th>
                  </tr>
              </thead>
              <tbody>
                  ${fatRows}
                  <tr class="row-total">
                      <td>FECHAMENTO ANUAL</td>
                      <td class="text-center font-mono" style="color:var(--blue-dark);">${formatarMoeda(totAno26)}</td>
                      <td class="text-center font-mono ${varTot26_25 > 0 ? 'delta-pos' : varTot26_25 < 0 ? 'delta-neg' : ''}">${varTot26_25 !== 0 ? varTot26_25.toFixed(1) + '%' : '-'}</td>
                      <td class="text-center font-mono">${formatarMoeda(totAno25)}</td>
                      <td class="text-center font-mono ${varTot25_24 > 0 ? 'delta-pos' : varTot25_24 < 0 ? 'delta-neg' : ''}">${varTot25_24 !== 0 ? varTot25_24.toFixed(1) + '%' : '-'}</td>
                      <td class="text-center font-mono">${formatarMoeda(totAno24)}</td>
                  </tr>
                  <tr class="row-total" style="background:#f1f5f9; border-top: 1px solid var(--border);">
                      <td>MÉDIA MENSAL AFERIDA</td>
                      <td class="text-center font-mono">${formatarMoeda(medGeral26)}</td>
                      <td class="text-center font-mono ${varMedGeral26_25 > 0 ? 'delta-pos' : varMedGeral26_25 < 0 ? 'delta-neg' : ''}">${varMedGeral26_25 !== 0 ? varMedGeral26_25.toFixed(1) + '%' : '-'}</td>
                      <td class="text-center font-mono">${formatarMoeda(medGeral25)}</td>
                      <td class="text-center font-mono ${varMedGeral25_24 > 0 ? 'delta-pos' : varMedGeral25_24 < 0 ? 'delta-neg' : ''}">${varMedGeral25_24 !== 0 ? varMedGeral25_24.toFixed(1) + '%' : '-'}</td>
                      <td class="text-center font-mono">${formatarMoeda(medGeral24)}</td>
                  </tr>
              </tbody>
          </table>
      </div>

      <h2>5. Potencial Operacional Estimado</h2>
      <div class="grid-2">
          <div class="card hover-card" style="margin-bottom:0; display: flex; flex-direction: column; justify-content: center;">
              <div class="metric-label" style="margin-bottom: 1.25rem;">Parâmetros da Carteira de Recebíveis</div>
              <div style="font-size:1rem; margin-bottom:1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">Ticket Médio Operado: <strong class="font-mono" style="color:var(--text); float: right;">${formatarMoeda(analise.dados_potencial?.ticket_medio)}</strong></div>
              <div style="font-size:1rem; margin-bottom:1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">Prazo de Vendas (DPLS): <strong style="color:var(--text); float: right;">${analise.dados_potencial?.prazo_medio_dpls || '-'}</strong></div>
              <div style="font-size:1rem;">Representatividade à Prazo: <strong class="font-mono" style="color:var(--blue); float: right;">${analise.dados_potencial?.forma_recebimento_prazo || 0}% do Volume</strong></div>
          </div>
          <div class="card hover-card" style="margin-bottom:0; background:#f0fdf4; border: 1px solid #86efac; display:flex; flex-direction:column; justify-content:center; align-items:center;">
              <div class="metric-label" style="color:#166534; font-size: 0.9rem;">Expectativa Real de Antecipação (Mensal)</div>
              <div class="metric-value font-mono" style="color:#15803d; font-size:2.8rem; margin-top:0.75rem;">${formatarMoeda(analise.dados_potencial?.potencial_estimado)}</div>
          </div>
      </div>

      <div class="print-break"></div>

      <h2>6. Alavancagem e Endividamento Bancário (SCR)</h2>
      <div class="grid-3">
          <div class="table-wrap hover-card" style="grid-column: span 1; display:flex; flex-direction:column; margin-bottom:0;">
              <table style="flex-grow: 1;">
                  <thead><tr><th colspan="2" class="text-center" style="font-size: 0.9rem;">Resumo Passivo</th></tr></thead>
                  <tbody>
                      <tr><td style="font-weight: 600;">Curto Prazo (CP)</td><td class="text-right font-bold font-mono">${formatarMoeda(curtoPrazo)}</td></tr>
                      <tr><td style="font-weight: 600;">Longo Prazo (LP)</td><td class="text-right font-bold font-mono">${formatarMoeda(longoPrazo)}</td></tr>
                      <tr><td style="font-weight: 800; background: #fef2f2; color: var(--red);">Dívida Global Total</td><td class="text-right font-bold font-mono" style="background: #fef2f2; color:var(--red); font-size:1.1rem;">${formatarMoeda(totalBancosDet)}</td></tr>
                      <tr><td colspan="2" class="text-center" style="font-size:0.9rem; padding: 2rem 1.5rem; background:#f8fafc;">
                          Multiplicador de Alavancagem:<br>
                          <strong style="color:var(--blue-dark); font-size: 1.5rem; display: block; margin-top: 0.5rem;">${alavancagem} x Fat. Médio</strong>
                      </td></tr>
                  </tbody>
              </table>
          </div>
          
          <div class="card hover-card" style="grid-column: span 2; padding: 2rem; margin-bottom:0;">
              <div class="metric-label" style="margin-bottom: 1.5rem;">Share de Credores (Concentração)</div>
              <div class="chart-container" style="height: 220px;"><canvas id="endivChart"></canvas></div>
          </div>
      </div>
      
      <div class="table-wrap" style="margin-top: 2rem;">
          <table>
              <thead><tr><th>Agente Financeiro (Credor)</th><th>Linha de Crédito / Modalidade</th><th class="text-right">Saldo Devedor Declarado</th></tr></thead>
              <tbody>
                  ${bancoRows}
                  ${totalBancosDet > 0 ? `<tr class="row-total"><td colspan="2">SOMA DO ENDIVIDAMENTO MAPEADO</td><td class="text-right font-mono" style="color:var(--red); font-size:1.15rem;">${formatarMoeda(totalBancosDet)}</td></tr>` : ''}
              </tbody>
          </table>
      </div>

      <h2>7. Market Check (Referências e Fundos)</h2>
      <div class="table-wrap">
          <table>
              <thead>
                <tr>
                  <th>Instituição</th>
                  <th class="text-center">Últ. Op</th>
                  <th class="text-right">VOP</th>
                  <th class="text-right">Limite Aprovado</th>
                  <th class="text-right">Risco / Exposição</th>
                  <th class="text-center">Liq / Atraso (%)</th>
                  <th class="text-center">Conc. Máx (%)</th>
                </tr>
              </thead>
              <tbody>
                  ${refRows}
              </tbody>
          </table>
      </div>

      <h2>8. Apontamentos Restritivos & Jurídico</h2>
      <div class="grid-2" style="margin-bottom: 2rem;">
          <div class="card hover-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px solid ${totalRestritivos > 0 ? '#fca5a5' : '#86efac'}; background: ${totalRestritivos > 0 ? '#fef2f2' : '#f0fdf4'};">
              <div class="metric-label" style="color: ${totalRestritivos > 0 ? '#991b1b' : '#166534'}; font-size: 0.9rem;">Volume Financeiro Restritivo</div>
              <div class="metric-value font-mono" style="color: ${totalRestritivos > 0 ? '#b91c1c' : '#15803d'}; font-size:2.5rem; margin-top:0.75rem;">${formatarMoeda(totalRestritivos)}</div>
          </div>
          <div class="card hover-card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px solid ${qtdRestritivos > 0 ? '#fde047' : '#86efac'}; background: ${qtdRestritivos > 0 ? '#fefce8' : '#f0fdf4'};">
              <div class="metric-label" style="color: ${qtdRestritivos > 0 ? '#854d0e' : '#166534'}; font-size: 0.9rem;">Total de Ocorrências (Serasa)</div>
              <div class="metric-value font-mono" style="color: ${qtdRestritivos > 0 ? '#a16207' : '#15803d'}; font-size:2.5rem; margin-top:0.75rem;">${qtdRestritivos}</div>
          </div>
      </div>

      ${totalRestritivos > 0 || qtdRestritivos > 0 ? `
      <div class="table-wrap">
          <table>
              <thead><tr><th>Documento Onerado (Empresa/Sócio)</th><th>Natureza da Pendência</th><th class="text-center">Volume</th><th class="text-right">Montante Restritivo</th></tr></thead>
              <tbody>
                  ${restritivosRows}
              </tbody>
          </table>
      </div>
      ` : ''}

      <div class="grid-2">
          <div class="card hover-card" style="padding:2rem; border-left: 6px solid #fca5a5; cursor: pointer; background: #fff;">
              <div style="font-weight:900; font-size:1rem; color:var(--red); margin-bottom:1rem; text-transform:uppercase;">⚠️ Relatório Jurídico (Processos)</div>
              <div class="expandable-box">
                  <div style="font-size:0.95rem; color:#334155; white-space: pre-wrap; line-height: 1.7;">${analise.dados_juridico?.relatorio_completo || analise.juridico_tramitacao || 'Nenhum apontamento judicial crítico localizado nas raspagens.'}</div>
                  <div class="expandable-fade" style="height: 60px;"></div>
              </div>
          </div>
          
          <div class="card hover-card" style="padding:2rem; border-left: 6px solid #93c5fd; cursor: pointer; background: #fff;">
              <div style="font-weight:900; font-size:1rem; color:var(--blue-dark); margin-bottom:1rem; text-transform:uppercase;">🔍 Clipping Mídia / Reputação</div>
              <div class="expandable-box">
                  <div style="font-size:0.95rem; color:#334155; white-space: pre-wrap; line-height: 1.7;">${analise.noticias_midia || 'Nada consta em pesquisas reputacionais desabonadoras ativas.'}</div>
                  <div class="expandable-fade" style="height: 60px;"></div>
              </div>
          </div>
      </div>

      <div class="print-break"></div>

      <div class="parecer-wrapper" style="margin-top: 2rem;">
          <div class="parecer-header">Parecer Técnico Formal - Mesa de Risco</div>
          <div class="parecer-body">
              <span style="color: var(--blue-dark); font-weight: 900; font-size: 1.15rem; display:block; margin-bottom: 1rem;">
                  RECOMENDAÇÃO DO ANALISTA: <span style="color: var(--blue);">${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}</span>
              </span>
              
              <div style="margin-bottom: 1rem;">
                  <strong style="color: var(--blue-dark); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">Justificativa do Analista:</strong>
                  <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1rem; border-radius: 0.5rem; font-size: 0.95rem;">
                    ${analise.parecer_analista || 'Sem parecer técnico elaborado para este dossiê.'}
                  </div>
              </div>

              ${analise.parecer_comite ? `
              <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                  <strong style="color: var(--blue-dark); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">Deliberação Oficial do Comitê:</strong>
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 1rem; border-radius: 0.5rem; color: #1e3a8a; font-weight: 500; font-size: 0.95rem;">
                    ${analise.parecer_comite}
                  </div>
              </div>
              ` : ''}
          </div>
          <div class="parecer-footer">
            Relatório Oficial validado digitalmente por: <strong style="color: var(--blue-dark); text-transform: uppercase;">${analise.analista || item.comercial || 'ANALISTA DE CRÉDITO RESPONSÁVEL'}</strong>
          </div>
      </div>

  </div>

  <script>
      const endivLabels = ${arrayEndivLabels};
      const endivData = ${arrayEndivData};
      
      Chart.defaults.font.family = "'Inter', sans-serif";
      
      const ctxFat = document.getElementById('fatChart').getContext('2d');
      new Chart(ctxFat, {
          type: 'bar',
          data: {
              labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
              datasets: [
                  { label: '2026', data: ${arrayFat2026}, backgroundColor: '#1e3a8a', borderRadius: 4 },
                  { label: '2025', data: ${arrayFat2025}, backgroundColor: '#3b82f6', borderRadius: 4 },
                  { label: '2024', data: ${arrayFat2024}, backgroundColor: '#cbd5e1', borderRadius: 4 }
              ]
          },
          options: { 
              responsive: true, maintainAspectRatio: false,
              plugins: { 
                  legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } 
              },
              scales: { 
                  y: { 
                      display: true, 
                      grid: { borderDash: [4, 4] },
                      ticks: { callback: function(value) { return 'R$ ' + (value / 1000).toLocaleString('pt-BR') + 'k'; } } 
                  },
                  x: { grid: { display: false } }
              }
          }
      });

      if(endivLabels.length > 0 && endivData.length > 0) {
          const ctxEndiv = document.getElementById('endivChart').getContext('2d');
          new Chart(ctxEndiv, {
              type: 'doughnut',
              data: {
                  labels: endivLabels,
                  datasets: [{
                      data: endivData,
                      backgroundColor: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#0d9488', '#ea580c', '#334155'],
                      borderWidth: 2,
                      borderColor: '#ffffff'
                  }]
              },
              options: { 
                  responsive: true, maintainAspectRatio: false, cutout: '65%',
                  plugins: { 
                      legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } } 
                  } 
              }
          });
      }

      const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
      
      if (orgaJson && orgaJson.nodes && orgaJson.edges) {
          const uniqueNodesMap = new Map();
          orgaJson.nodes.forEach(n => {
              if (!uniqueNodesMap.has(n.id)) {
                  uniqueNodesMap.set(n.id, n);
              }
          });
          const uniqueNodesArray = Array.from(uniqueNodesMap.values());

          const uniqueEdgesMap = new Map();
          orgaJson.edges.forEach(e => {
              if (!uniqueEdgesMap.has(e.id)) {
                  uniqueEdgesMap.set(e.id, e);
              }
          });
          const uniqueEdgesArray = Array.from(uniqueEdgesMap.values());

          const container = document.getElementById('network-container');
          if (container) {
              const nodes = new vis.DataSet(uniqueNodesArray.map(n => {
                  let rawLabel = (n.data && n.data.label) ? n.data.label : (n.label || n.id || "Sem Nome");
                  rawLabel = String(rawLabel).replace(/<[^>]*>?/gm, ''); 

                  const words = rawLabel.split(' ');
                  let lines = [];
                  let currentLine = '';
                  words.forEach(w => {
                      if ((currentLine + w).length > 15) {
                          if (currentLine.trim() !== '') lines.push(currentLine.trim());
                          currentLine = w + ' ';
                      } else {
                          currentLine += w + ' ';
                      }
                  });
                  if (currentLine.trim() !== '') lines.push(currentLine.trim());
                  const finalLabel = lines.join(String.fromCharCode(10));

                  const bgColor = (n.style && n.style.backgroundColor) ? n.style.backgroundColor : '#1e3a8a';
                  const borderColor = (n.style && n.style.borderColor) ? n.style.borderColor : 'rgba(0,0,0,0.1)';

                  return {
                      id: n.id, 
                      label: finalLabel,
                      shape: 'circle',
                      margin: 12, 
                      font: { color: '#ffffff', size: 11, face: 'Inter', bold: true },
                      color: { 
                          background: bgColor, 
                          border: borderColor,
                          highlight: { background: bgColor, border: '#000000' }
                      },
                      borderWidth: 1,
                      shadow: { enabled: true, color: 'rgba(0,0,0,0.15)', size: 10, x: 0, y: 5 }
                  };
              }));

              const edges = new vis.DataSet(uniqueEdgesArray.map(e => {
                  const edgeColor = (e.style && e.style.stroke) ? e.style.stroke : '#94a3b8';
                  const isDashed = (e.style && e.style.strokeDasharray) ? true : false;
                  
                  return {
                      id: e.id, 
                      from: e.source || e.from, 
                      to: e.target || e.to,
                      label: e.label || '',
                      color: { color: edgeColor, highlight: edgeColor }, 
                      arrows: 'to',
                      font: { size: 9, color: '#475569', face: 'Inter', strokeWidth: 3, strokeColor: '#ffffff' },
                      dashes: isDashed,
                      width: 2
                  };
              }));
              
              new vis.Network(container, { nodes, edges }, {
                  layout: { randomSeed: 2 },
                  physics: {
                      solver: 'forceAtlas2Based',
                      forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
                      maxVelocity: 50, timestep: 0.35, stabilization: { iterations: 150 }
                  },
                  interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true }
              });
          }
      }
  </script>

  </body>
  </html>
  `;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function GerarAnalise({ analise }: { analise: any }) {
  const [gerando, setGerando] = useState(false);

  const handleGerar = async () => {
    setGerando(true);
    try {
      const htmlContent = await gerarHtmlDossie(analise);
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert("Erro ao estruturar dados na impressão do relatório.");
      console.error(err);
    } finally {
      setGerando(false);
    }
  };

  return (
    <button
      onClick={handleGerar}
      disabled={gerando || !analise.id}
      className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-800 text-white font-bold px-4 py-2 text-[11px] uppercase cursor-pointer shadow-md transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed rounded"
      title={!analise.id ? "Selecione uma análise real para gerar o relatório" : "Gerar Relatório Executivo HTML"}
    >
      {gerando ? "⏳ GERANDO..." : "📄 RELATÓRIO PDF/HTML"}
    </button>
  );
}