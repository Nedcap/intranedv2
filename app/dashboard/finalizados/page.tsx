/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// COMPILADOR EM TEMPO REAL PARA O NOVO MODELO BASEADO EM JSON (V8 MOTOR)
// ============================================================================
const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
};

const compilarJsonParaHtml = (item: any) => {
  if (!item) return "";
  
  const analise = item.dados_consolidados || {};
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const empresaNome = item.empresa_nome || analise.razao_social || 'EMPRESA NÃO INFORMADA';
  const cnpjDoc = item.cnpj || analise.cnpj || '-';
  const localizacaoReal = analise.localizacao?.trim() || "Brasil";
  const enderecoQuery = encodeURIComponent(localizacaoReal);

  let totalLimites = 0;
  const propostasRows = analise.propostas && analise.propostas.length > 0 
    ? analise.propostas.map((p: any) => {
        totalLimites += Number(p.limite) || 0;
        return `<tr>
            <td style="font-weight:600;">${p.modalidade || '-'}</td>
            <td class="text-right font-bold" style="color:var(--blue);">${formatarMoeda(p.limite)}</td>
            <td class="text-center">${p.prazo || '-'}</td>
            <td class="text-center">${p.tranche || '-'}</td>
            <td class="text-center font-bold">${p.taxa || '-'}</td>
            <td>${p.garantia || '-'}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6" class="text-center" style="color:var(--muted);">Nenhuma proposta informada.</td></tr>`;

  const empresasRows = analise.empresas_grupo && analise.empresas_grupo.length > 0 
    ? analise.empresas_grupo.map((e: any) => `<tr>
          <td style="font-weight:600; font-size:0.85rem;">${e.empresa || '-'}</td>
          <td style="font-size:0.85rem;" class="font-mono">${e.cnpj || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.fundacao || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.idade || '-'}</td>
      </tr>`).join("") 
    : `<tr><td colspan="4" class="text-center" style="color:var(--muted);">Nenhuma empresa informada.</td></tr>`;

  const socioRows = analise.socios && analise.socios.length > 0 
    ? analise.socios.map((s: any) => `<tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px;"><strong>${s.nome || '-'}</strong></td>
          <td style="padding: 8px 10px; color: var(--muted); text-align:center;">${s.funcao || 'Sócio'}</td>
          <td style="padding: 8px 10px; color: var(--muted); text-align:center;">Assina Contrato: ${s.figure_contrato || 'Sim'}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 600;" class="font-mono">${s.perc || 0}%</td>
      </tr>`).join("") 
    : `<tr><td colspan="4" style="color:var(--muted); text-align:center; padding: 10px;">Nenhum sócio informado.</td></tr>`;

  let totalPatrimonio = 0;
  const patrimonioRows = analise.patrimonios && analise.patrimonios.length > 0 
    ? analise.patrimonios.map((p: any) => {
        totalPatrimonio += Number(p.valor) || 0;
        return `<tr>
            <td style="font-weight:600;">${p.descricao || '-'} <span style="font-weight:normal; color:var(--muted);">(${p.socio || 'Sócio'})</span></td>
            <td class="text-right font-bold font-mono text-green-700">${formatarMoeda(p.valor)}</td>
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
        return `<tr>
            <td style="font-weight:600; font-size:0.85rem;">${b.instituicao || '-'}</td>
            <td style="font-size:0.85rem;">${b.modalidade || '-'} <span style="color:var(--muted); font-size:10px;">(${b.tipo} - ${b.prazo})</span></td>
            <td class="text-right font-bold font-mono" style="font-size:0.85rem; color:var(--red);">${formatarMoeda(v)}</td>
        </tr>`;
    }).join("")
    : `<tr><td colspan="3" class="text-center" style="color:var(--muted);">Nenhum detalhamento bancário mapeado.</td></tr>`;

  let totalRestritivos = 0, qtdRestritivos = 0;
  const restritivosRows = analise.restritivos && analise.restritivos.length > 0 
    ? analise.restritivos.map((r: any) => {
        totalRestritivos += Number(r.valor) || 0;
        qtdRestritivos += Number(r.qtd) || 1;
        return `<tr>
            <td style="font-weight:600;">${r.empresa_socio || '-'}</td>
            <td style="color:var(--yellow); font-weight:bold;">${r.restritivo || '-'}</td>
            <td class="text-center font-mono">${r.qtd || 1}</td>
            <td class="text-right font-bold font-mono text-red-600">${formatarMoeda(r.valor)}</td>
        </tr>`;
    }).join("") : ``;

  const refRows = analise.referencias && analise.referencias.length > 0
    ? analise.referencias.map((r: any) => `<tr>
        <td style="font-weight:600;">${r.instituicao || '-'}</td>
        <td class="text-center font-mono">${r.cliente_desde ? new Date(r.cliente_desde).toLocaleDateString('pt-BR') : '-'}</td>
        <td class="text-center font-mono">${r.ultima_operacao ? new Date(r.ultima_operacao).toLocaleDateString('pt-BR') : '-'}</td>
        <td class="text-right font-bold font-mono text-blue-600">${formatarMoeda(r.limite_global)}</td>
        <td class="text-right font-bold font-mono text-red-600">${formatarMoeda(r.risco_total)}</td>
        <td class="text-center" style="font-size:11px;">Pontual: ${r.liquidez_pontual || '-'} | 5d: ${r.liquidez_5_dias || '-'}</td>
        <td class="text-center font-mono">${r.concentracao || 0}%</td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="text-center" style="color:var(--muted);">Nenhuma referência mapeada.</td></tr>`;

  const clientesRows = analise.clientes && analise.clientes.length > 0 ? analise.clientes.map((c: any) => `<li>${c.nome || c}</li>`).join("") : "Não informado";
  const fornecedoresRows = analise.fornecedores && analise.fornecedores.length > 0 ? analise.fornecedores.map((f: any) => `<li>${f.nome || f}</li>`).join("") : "Não informado";
  const concorrentesRows = analise.concorrentes && analise.concorrentes.length > 0 ? analise.concorrentes.map((c: any) => `<li>${c.nome || c}</li>`).join("") : "Não informado";

  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  let tot2024 = 0, tot2025 = 0, tot2026 = 0;
  let qtd2024 = 0, qtd2025 = 0, qtd2026 = 0;

  const fatRows = meses.map(mes => {
    const val2024 = Number(analise.dados_faturamento?.["2024"]?.[mes]) || 0;
    const val2025 = Number(analise.dados_faturamento?.["2025"]?.[mes]) || 0;
    const val2026 = Number(analise.dados_faturamento?.["2026"]?.[mes]) || 0;
    
    tot2024 += val2024; if(val2024 > 0) qtd2024++;
    tot2025 += val2025; if(val2025 > 0) qtd2025++;
    tot2026 += val2026; if(val2026 > 0) qtd2026++;

    const delta1 = val2024 > 0 ? ((val2025 - val2024) / val2024) * 100 : 0;
    const delta2 = val2025 > 0 ? ((val2026 - val2025) / val2025) * 100 : 0;
    
    return `<tr>
        <td style="font-weight: 600; text-transform: uppercase;">${mes}</td>
        <td class="text-center font-mono">${formatarMoeda(val2026)}</td>
        <td class="text-center font-mono ${delta2 > 0 ? 'delta-pos' : delta2 < 0 ? 'delta-neg' : ''}">${delta2 !== 0 ? delta2.toFixed(1) + '%' : '-'}</td>
        <td class="text-center font-mono">${formatarMoeda(val2025)}</td>
        <td class="text-center font-mono ${delta1 > 0 ? 'delta-pos' : delta1 < 0 ? 'delta-neg' : ''}">${delta1 !== 0 ? delta1.toFixed(1) + '%' : '-'}</td>
        <td class="text-center font-mono">${formatarMoeda(val2024)}</td>
    </tr>`;
  }).join("");

  const med2024 = qtd2024 > 0 ? tot2024 / qtd2024 : 0;
  const med2025 = qtd2025 > 0 ? tot2025 / qtd2025 : 0;
  const med2026 = qtd2026 > 0 ? tot2026 / qtd2026 : 0;

  const faturamentoReferencia = med2026 > 0 ? med2026 : (med2025 > 0 ? med2025 : med2024);
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

  // Varredura Inteligente de Mídias
  const imagensExtraidas = new Set<string>();
  const normalizarUrl = (u: any) => {
    if (typeof u !== 'string') return null;
    const limpa = u.trim();
    if (limpa === '') return null;
    try {
      const parsedUrl = new URL(limpa.startsWith('/') ? `${window.location.origin}${limpa}` : limpa);
      if (/\.(jpeg|jpg|gif|png|webp)/i.test(parsedUrl.pathname)) return limpa;
      return null;
    } catch {
      if (/\.(jpeg|jpg|gif|png|webp)/i.test(limpa)) return limpa;
      return null;
    }
  };

  if (Array.isArray(analise.galeria_urls)) {
    analise.galeria_urls.forEach((url: string) => { const v = normalizarUrl(url); if(v) imagensExtraidas.add(v); });
  }
  if (analise.anexos) {
    if (Array.isArray(analise.anexos.galeria_urls)) {
      analise.anexos.galeria_urls.forEach((url: string) => { const v = normalizarUrl(url); if(v) imagensExtraidas.add(v); });
    }
    const f = normalizarUrl(analise.anexos.fachada_url); if (f) imagensExtraidas.add(f);
    const vi = normalizarUrl(analise.anexos.fotos_visita_url); if (vi) imagensExtraidas.add(vi);
  }
  if (Array.isArray(item.dados_documentos)) {
    item.dados_documentos.forEach((url: string) => { const v = normalizarUrl(url); if(v) imagensExtraidas.add(v); });
  }

  const fotosUnicas = Array.from(imagensExtraidas);
  const galeriaHTML = fotosUnicas.length > 0 
    ? `<div class="print-break"></div>
    <h2 style="margin-top: 3.5rem;">📸 Galeria de Fotos e Evidências (${fotosUnicas.length})</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2.5rem;">
        ${fotosUnicas.map(url => `
            <div class="card" style="padding: 0.5rem; display: flex; justify-content: center; align-items: center; background: #f8fafc;">
                <img src="${url}" style="width: 100%; height: 260px; object-fit: cover; border-radius: 0.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" alt="Evidência">
            </div>
        `).join("")}
    </div>` : '';

  const organogramaUrlTratado = normalizarUrl(analise.anexos?.organograma_url);

  return `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dossiê Executivo - ${empresaNome}</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
          :root { --bg: #ffffff; --card: #ffffff; --text: #0f172a; --muted: #64748b; --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; }
          body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; font-size: 13px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 2.5rem; border-radius: 0.75rem; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.2); margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
          @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: center; } }
          .header h1 { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;}
          .header .meta { font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem; font-weight: 500; }
          .header .badge-top { background: rgba(255,255,255,0.25); padding: 0.5rem 1.25rem; border-radius: 2rem; font-weight: 700; font-size: 0.85rem; backdrop-filter: blur(4px); text-transform: uppercase; border: 1px solid rgba(255,255,255,0.3);}
          h2 { font-size: 1.2rem; font-weight: 800; color: var(--blue-dark); margin: 2.5rem 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;}
          h2::before { content: ""; display: inline-block; width: 6px; height: 1.2rem; background-color: var(--blue); border-radius: 4px; }
          .grid-2, .grid-3, .grid-4 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
          @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-4 { grid-template-columns: repeat(4, 1fr); } }
          .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .metric-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.5rem; }
          .metric-value { font-size: 1.5rem; font-weight: 800; color: var(--text); }
          .table-wrap { overflow-x: auto; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; text-align: left; }
          th, td { padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border); }
          th { background: #f8fafc; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
          tr:hover { background: #f1f5f9; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .delta-pos { color: var(--green); font-weight: 700; }
          .delta-neg { color: var(--red); font-weight: 700; }
          .row-total td { background: #f8fafc; font-weight: 800; font-size: 0.9rem; border-top: 2px solid var(--border); }
          .chart-container { position: relative; height: 280px; width: 100%; }
          .parecer-wrapper { background: white; border-radius: 0.75rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden; position: relative; margin-bottom: 2rem;}
          .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: var(--blue); }
          .parecer-header { background: #f8fafc; padding: 1.25rem 2rem; font-weight: 800; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size:1rem;}
          .parecer-body { padding: 2rem; font-size: 1rem; line-height: 1.7; color: #334155; white-space: pre-wrap; text-align: justify;}
          .parecer-footer { background: #f8fafc; padding: 1rem 2rem; border-top: 1px solid #e2e8f0; color: var(--muted); font-size: 0.85rem; font-weight: 600; text-align: right;}
          .btn-maps { background: var(--blue); color: white; padding: 10px 18px; border-radius: 0.5rem; text-decoration: none; font-size: 0.85rem; font-weight: 700; display: inline-block; transition: 0.2s; box-shadow: 0 4px 6px rgba(37,99,235,0.2); border: 1px solid rgba(0,0,0,0.1); }
          .btn-maps:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(37,99,235,0.3); }
          .org-container { width: 100%; height: 500px; border-radius: 0.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; }
          ul.simple-list { margin: 0; padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.5; color: var(--text); }
          @media print { .print-break { page-break-before: always; } body { background: white; } .card, .table-wrap { box-shadow: none; border: 1px solid #cbd5e1; } .header { padding: 1rem; color: black; background: white; border: 2px solid black; } }
      </style>
  </head>
  <body>
  <div class="container">
      <div class="header">
          <div>
              <h1>${empresaNome}</h1>
              <div class="meta">CNPJ: ${cnpjDoc} | Data Emissão: ${dataAtual} | Analista: ${analise.analista || item.comercial || '-'} | Gerente: ${analise.gerente || '-'}</div>
          </div>
          <div class="badge-top">RECOMENDAÇÃO DO ANALISTA: ${analise.recomendacao_analista || 'EM ANÁLISE'}</div>
      </div>

      <div class="grid-3" style="margin-bottom: 1.5rem;">
          <div class="card" style="grid-column: span 1; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px dashed var(--blue);">
              <div class="metric-label">Rating Sugerido</div>
              <div class="metric-value" style="color: var(--yellow); font-size: 1.8rem;">${analise.rating || '-'}</div>
          </div>
          <div class="card" style="grid-column: span 2;">
              <div class="metric-label">Resumo Executivo (Visita Comercial)</div>
              <div style="font-size: 0.9rem; color: #475569; line-height: 1.6; white-space: pre-wrap;">${analise.resumo_visita || 'Sem resumo cadastrado.'}</div>
          </div>
      </div>

      ${analise.parecer_executivo ? `
      <div class="card" style="margin-bottom: 1.5rem; border-top: 4px solid var(--blue); background: #f4f7ff;">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--blue-dark); text-transform: uppercase; margin-bottom: 0.75rem;">🧠 Súmula Executiva de Crédito (Parecer Motor IA V8)</div>
          <div style="font-size: 0.95rem; color: #1e293b; line-height: 1.65; white-space: pre-wrap;">${analise.parecer_executivo}</div>
      </div>` : ''}

      <h2>1. Propostas e Condições Comerciais</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Modalidade</th><th class="text-right">Limite</th><th class="text-center">Prazo Médio</th><th class="text-center">Tranche</th><th class="text-center">Taxa</th><th>Garantia</th></tr></thead>
              <tbody>
                  ${propostasRows}
                  ${totalLimites > 0 ? `<tr class="row-total"><td>LIMITE TOTAL SOLICITADO</td><td class="text-right">${formatarMoeda(totalLimites)}</td><td colspan="4"></td></tr>` : ''}
              </tbody>
          </table>
      </div>

      <h2>2. Background da Empresa & Societário</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Empresa (Grupo Econômico)</th><th>CNPJ</th><th class="text-center">Fundação</th><th class="text-center">Idade</th></tr></thead>
              <tbody>${empresasRows}</tbody>
          </table>
      </div>

      <div class="grid-2">
          <div class="card">
              <div class="metric-label">Localização & Ramo de Atividade</div>
              <div style="font-weight: 700;">${analise.localizacao || '-'}<br><span style="font-weight:500; color:var(--muted);">${analise.ramo || '-'}</span></div>
          </div>
          <div class="card">
              <div class="metric-label">Quadro Societário & Assinaturas</div>
              <table style="width:100%; font-size: 0.85rem;">${socioRows}</table>
          </div>
      </div>

      <h2 style="margin-top: 3.5rem;">3. Organograma / Teia Societária</h2>
      <div style="margin-bottom: 2.5rem;">
          ${analise.organograma_json && analise.organograma_json.nodes ? `
          <div class="card"><div id="network-container" class="org-container"></div></div>` : organogramaUrlTratado ? `
          <div class="card" style="display:flex; justify-content:center;"><img src="${organogramaUrlTratado}" style="max-width: 100%; max-height: 600px; object-fit: contain;"></div>` : `
          <div class="card" style="display:flex; justify-content:center; align-items:center; height:150px; color:var(--muted);">[NENHUM ORGANOGRAMA VINCULADO]</div>`}
      </div>

      ${galeriaHTML}

      <div class="print-break"></div>
      <h2>4. Faturamento Consolidado</h2>
      <div class="card" style="margin-bottom: 1.5rem;"><div class="chart-container"><canvas id="fatChart"></canvas></div></div>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Mês</th><th class="text-center">Realizado 2026</th><th class="text-center">Variação (%)</th><th class="text-center">Realizado 2025</th><th class="text-center">Variação (%)</th><th class="text-center">Realizado 2024</th></tr></thead>
              <tbody>
                  ${fatRows}
                  <tr class="row-total"><td>TOTAL ANUAL</td><td class="text-center">${formatarMoeda(tot2026)}</td><td class="text-center">--</td><td class="text-center">${formatarMoeda(tot2025)}</td><td class="text-center">--</td><td class="text-center">${formatarMoeda(tot2024)}</td></tr>
              </tbody>
          </table>
      </div>

      <h2>5. Potencial de Negócios</h2>
      <div class="grid-2">
          <div class="card">
              <div style="font-size:0.9rem;">Ticket Médio: <strong>${formatarMoeda(analise.dados_potencial?.ticket_medio)}</strong></div>
              <div style="font-size:0.9rem;">Prazo de Vendas: <strong>${analise.dados_potencial?.prazo_medio_dpls || '-'}</strong></div>
          </div>
          <div class="card" style="background:#f0fdf4; border: 1px solid #86efac; text-align:center;">
              <div class="metric-label" style="color:#166534;">Potencial Real Estimado</div>
              <div class="metric-value" style="color:#15803d; font-size:2.2rem;">${formatarMoeda(analise.dados_potencial?.potencial_estimado)}</div>
          </div>
      </div>

      <div class="print-break"></div>
      <h2>6. Passivo Bancário / Endividamento (SCR Bacen)</h2>
      <div class="grid-3">
          <div class="table-wrap" style="grid-column: span 1;">
              <table>
                  <tr><td>Volume Total</td><td class="text-right font-bold" style="color:var(--red);">${formatarMoeda(totalBancosDet)}</td></tr>
                  <tr><td colspan="2" class="text-center"><strong>${alavancagem} x Fat. Médio</strong></td></tr>
              </table>
          </div>
          <div class="card" style="grid-column: span 2;"><div class="chart-container" style="height: 180px;"><canvas id="endivChart"></canvas></div></div>
      </div>

      <h2>7. Referências e Fundos de Investimentos</h2>
      <div class="table-wrap"><table><tbody>${refRows}</tbody></table></div>

      <h2>8. Apontamentos Restritivos e Análise Jurídica</h2>
      <div class="grid-2">
          <div class="card" style="border-left: 4px solid #fca5a5;"><div>⚠️ Litígios Ativos</div><p>${analise.dados_juridico?.relatorio_completo || analise.juridico_tramitacao || 'Nenhum apontamento crítico.'}</p></div>
          <div class="card" style="border-left: 4px solid #93c5fd;"><div>🔍 Compliance</div><p>${analise.noticias_midia || 'Nada consta em mídias sociais ou desabonadores.'}</p></div>
      </div>

      <div class="parecer-wrapper" style="margin-top: 3rem;">
          <div class="parecer-header">Parecer Técnico / Deliberação da Mesa de Risco</div>
          <div class="parecer-body">
              <strong>RECOMENDAÇÃO TÉCNICA: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}</strong><br/><br/>
              <p>Histórico e Parecer do Comitê:</p>
              <div id="historico-comite-placeholder"></div>
          </div>
      </div>
  </div>

  <script>
      const endivLabels = ${arrayEndivLabels}; const endivData = ${arrayEndivData};
      const ctxFat = document.getElementById('fatChart').getContext('2d');
      new Chart(ctxFat, {
          type: 'bar',
          data: {
              labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
              datasets: [
                  { label: '2026', data: ${arrayFat2026}, backgroundColor: '#2563eb' },
                  { label: '2025', data: ${arrayFat2025}, backgroundColor: '#60a5fa' },
                  { label: '2024', data: ${arrayFat2024}, backgroundColor: '#cbd5e1' }
              ]
          },
          options: { responsive: true, maintainAspectRatio: false }
      });

      if(endivLabels.length > 0 && endivData.length > 0) {
          const ctxEndiv = document.getElementById('endivChart').getContext('2d');
          new Chart(ctxEndiv, { type: 'pie', data: { labels: endivLabels, datasets: [{ data: endivData, backgroundColor: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04'] }] }, options: { responsive: true, maintainAspectRatio: false } });
      }

      const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
      if (orgaJson && orgaJson.nodes && orgaJson.edges) {
          const container = document.getElementById('network-container');
          if (container) {
              const nodes = new vis.DataSet(orgaJson.nodes.map(n => ({ id: n.id, label: n.label || n.id, shape: 'circle', color: '#2563eb', font: { color: '#ffffff' } })));
              const edges = new vis.DataSet(orgaJson.edges.map(e => ({ from: e.from || e.source, to: e.to || e.target, arrows: 'to', color: '#94a3b8' })));
              new vis.Network(container, { nodes, edges }, { physics: { solver: 'repulsion' } });
          }
      }
  </script>
  </body>
  </html>`;
};

function calcularDiasUteis(dInicio: Date, dFim: Date) {
  let count = 0;
  const atual = new Date(dInicio.getTime());
  atual.setHours(12, 0, 0, 0);
  const fim = new Date(dFim.getTime());
  fim.setHours(12, 0, 0, 0);
  if (fim < atual) return 0;
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      count++;
    }
  }
  return count;
}

function parseDataSegura(dataStr: string) {
  if (!dataStr) return null;
  const apenasData = dataStr.trim().split("T")[0];
  return new Date(`${apenasData}T12:00:00`);
}

function simplificarNome(nome: string): string {
  if (!nome) return "";
  let n = nome.trim().toUpperCase();
  n = n.replace(/\b(LTDA|SA|S\/A|EIRELI|ME|EPP|MEI|CIA|SS|INC|CORP)\b/g, "");
  return n.replace(/\s+/g, " ").trim();
}

const obterIdsSubordinados = (usuarios: any[], liderId: string, visitados = new Set<string>()): string[] => {
  if (visitados.has(liderId)) return [];
  visitados.add(liderId);

  let resultado: string[] = [liderId];

  const subDiretos = usuarios.filter(u => {
    const lideres = u.permissoes?.lider_ids || (u.permissoes?.lider_id ? [u.permissoes.lider_id] : []);
    return Array.isArray(lideres) && lideres.includes(liderId);
  });

  subDiretos.forEach(sub => {
    resultado = [...resultado, ...obterIdsSubordinados(usuarios, sub.id, visitados)];
  });

  return Array.from(new Set(resultado));
};

export default function FinalizadosPage() {
  const [historico, setHistorico] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  
  const [modoFocoConsulta, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);
  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [htmlPreviewsInline, setHtmlPreviewsInline] = useState<Record<string, string>>({});
  
  const [avisoCopia, setAvisoCopia] = useState(false);

  const [linhaEditando, setLinhaEditando] = useState<string | null>(null);
  const [editDataRec, setEditDataRec] = useState("");
  const [editDataEnvio, setEditDataEnvio] = useState("");

  const [busca, setBusca] = useState(""); 
  const [mesesSel, setMesesSel] = useState<string[]>([]);
  const [termoBuscaCedente, setTermoBuscaCedente] = useState("");
  const [listaMeses, setListaMeses] = useState<string[]>([]);
  const [listaCedentes, setListaCedentes] = useState<string[]>([]);
  const [cedentesSel, setCedentesSel] = useState<string[]>([]);

  const [openMes, setOpenMes] = useState(false);
  const [openCedente, setOpenCedente] = useState(false);

  const refMes = useRef<HTMLDivElement>(null);
  const refCed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function clickFora(e: MouseEvent) {
      if (refMes.current && !refMes.current.contains(e.target as Node)) setOpenMes(false);
      if (refCed.current && !refCed.current.contains(e.target as Node)) setOpenCedente(false);
    }
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, []);

  const carregarVotosIniciais = useCallback(async (empresaNome: string) => {
    if (!empresaNome) return;
    const { data } = await supabase.from("votos").select("*").eq("empresa_nome", empresaNome);
    if (data) {
      setVotosAoVivo(prev => ({ ...prev, [empresaNome]: data }));
    }
  }, []);

  // 🔥 VINCULAÇÃO INTELIGENTE DE PREVIEWS (SUPORTA HTML ANTIGO E MODELOS EM JSON)
  const vincularPreVisualizacao = async (item: any) => {
    // Se o item já tiver os dados consolidados do novo motor JSON, compila em tempo real
    if (item.dados_consolidados && Object.keys(item.dados_consolidados).length > 0) {
      const htmlCompilado = compilarJsonParaHtml(item);
      setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: htmlCompilado }));
      return;
    }

    // Comportamento Legado: Busca arquivo físico .html se não houver o JSON estruturado
    if (!item.caminho_local) return;
    const urlLimpa = item.caminho_local.trim();
    if (urlLimpa.startsWith("http")) { 
      try {
        const res = await fetch(urlLimpa);
        const text = await res.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: text }));
      } catch { /* fallback */ }
      return;
    }
    const partes = urlLimpa.split(/[\\/]/);
    const nomeArquivo = partes[partes.length - 1].trim();
    try {
      const { data } = await supabase.storage.from("analises").download(nomeArquivo);
      if (data) {
        const text = await data.text();
        setHtmlPreviewsInline(prev => ({ ...prev, [item.id]: text }));
      }
    } catch (err) { console.error(err); }
  };

  const carregarHistorico = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      let query = supabase.from("analises").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

        if (cargoUser !== "master" && cargoUser !== "diretor") {
          const { data: todosUsuarios } = await supabase.from("usuarios").select("id, nome, permissoes");
          if (todosUsuarios) {
            const idsPermitidos = obterIdsSubordinados(todosUsuarios, user.id);
            const nomesPermitidos = todosUsuarios
              .filter(u => idsPermitidos.includes(u.id))
              .map(u => u.nome);
            query = query.in("comercial", nomesPermitidos);
          } else {
            query = query.eq("comercial", user.nome);
          }
        }
      }
      
      const { data } = await query.order("criado_em", { ascending: false });
      
      if (data) {
        const filtrado = data.filter(a => {
          const st = (a.status || "").toLowerCase().trim();
          const statusFinaisConfirmados = ["aprovado", "reprovado", "recusado", "rejeitado", "com restritivo", "finalizado"];
          return statusFinaisConfirmados.some(s => st.includes(s)) || (st !== "aberta" && !st.includes("comit") && !st.includes("aberto") && st !== "em análise" && st !== "");
        });

        const mesesUnicos = new Set<string>();
        const cedentesUnicos = new Set<string>();

        const historicoMapeado = filtrado.map((item) => {
          let mesRef = "S/D";
          let slaCalculado = 0;
          const dRec = parseDataSegura(item.data_recebimento);
          const dFim = parseDataSegura(item.criado_em);

          if (dRec) {
            mesRef = `${String(dRec.getMonth() + 1).padStart(2, "0")}/${dRec.getFullYear()}`;
            mesesUnicos.add(mesRef);
          } else {
            mesesUnicos.add("S/D");
          }
          if (dRec && dFim) {
            slaCalculado = calcularDiasUteis(dRec, dFim);
          }
          cedentesUnicos.add(simplificarNome(item.empresa_nome));
          return { ...item, _mesRef: mesRef, _sla: slaCalculado };
        });

        const mesesOrdenados = Array.from(mesesUnicos).sort((a, b) => {
          if (a === "S/D") return 1; if (b === "S/D") return -1;
          const [mA, yA] = a.split("/"); const [mB, yB] = b.split("/");
          return (parseInt(yB) * 100 + parseInt(mB)) - (parseInt(yA) * 100 + parseInt(mA));
        });
        
        setListaMeses(mesesOrdenados);
        setListaCedentes(Array.from(cedentesUnicos).sort());
        setMesesSel(mesesOrdenados);
        setHistorico(historicoMapeado);
        setCedentesSel(Array.from(cedentesUnicos));

        historicoMapeado.forEach(item => {
          carregarVotosIniciais(item.empresa_nome);
          vintularPreVisualizacao(item);
        });
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setCarregando(false); 
    }
  };

  useEffect(() => { carregarHistorico(); }, []);

  const iniciarEdicao = (item: any) => {
    setLinhaEditando(item.id);
    const dtRec = item.data_recebimento ? item.data_recebimento.split('T')[0] : "";
    const dtEnv = (item.criado_em || "").split('T')[0];
    setEditDataRec(dtRec);
    setEditDataEnvio(dtEnv);
  };

  const salvarEdicao = async (id: string) => {
    try {
      setSalvandoEdicao(true);
      const payload: any = { 
        data_recebimento: editDataRec ? `${editDataRec}T12:00:00` : null,
        criado_em: editDataEnvio ? `${editDataEnvio}T12:00:00` : null
      };

      const { error } = await supabase.from("analises").update(payload).eq("id", id);
      if (error) throw error;
      setLinhaEditando(null);
      await carregarHistorico();
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao atualizar as datas.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const ativarModoConsultaFoco = async (empresa: any) => {
    setEmpresaFocoAtivo(empresa);
    setModoFocoComite(true);
    const { data } = await supabase.from("chat_comite").select("*").eq("empresa_nome", empresa.empresa_nome).order("id", { ascending: true });
    if (data) setChatMsgs(data);
  };

  const desativarModoConsultaFoco = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setChatMsgs([]);
  };

  // 🔥 BANCO DE IMPRESSÃO INTEGRADO: SUPORTA ARQUIVOS .HTML E OBJETOS DO BANCO
  const baixarPdfAnalise = async (item: any) => {
    setGerandoPdfId(item.id);
    try {
      const { data: chat } = await supabase.from("chat_comite").select("*").eq("empresa_nome", item.empresa_nome).order("id", { ascending: true });
      
      let chatHtml = `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; width: 100%; max-height: 450px; overflow-y: hidden;">`;
      if (!chat || chat.length === 0) {
        chatHtml += `<p style="color: #94a3b8; font-style: italic; font-size: 14px;">Nenhum voto registrado no comitê.</p>`;
      } else {
        chat.forEach((m: any) => {
          chatHtml += `
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px; border-radius: 4px; color: #0f172a; text-align: left; line-height: 1.4;">
              <strong style="font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">${m.usuario}</strong><br/>
              <span style="font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap;">${m.mensagem}</span>
            </div>
          `;
        });
      }
      chatHtml += `</div>`;

      let analiseHtmlText = "";
      if (item.dados_consolidados && Object.keys(item.dados_consolidados).length > 0) {
        // Renderização instantânea do JSON V8
        analiseHtmlText = compilarJsonParaHtml(item);
      } else if (item.caminho_local) {
        // Fallback Legado para arquivos HTML gravados
        const urlLimpa = item.caminho_local.trim();
        if (urlLimpa.startsWith("http")) {
          try {
            const res = await fetch(urlLimpa);
            analiseHtmlText = await res.text();
          } catch { /* Fallback */ }
        } else {
          const partes = urlLimpa.split(/[\\/]/);
          const nomeArquivo = partes[partes.length - 1].trim();
          const { data } = await supabase.storage.from("analises").download(nomeArquivo);
          if (data) analiseHtmlText = await data.text();
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(analiseHtmlText, "text/html");
      
      // Injeta os históricos na mesa do PDF compilado
      const targetPlaceholder = doc.getElementById("historico-comite-placeholder");
      if (targetPlaceholder) {
        targetPlaceholder.innerHTML = chatHtml;
      } else {
        const allElements = doc.body.querySelectorAll("*");
        for (const el of Array.from(allElements)) {
          if (el.textContent && el.textContent.trim().toLowerCase() === "histórico do comitê" && el.children.length === 0) {
            let blockParent = el;
            while (blockParent && !['DIV', 'SECTION', 'TD', 'LI'].includes(blockParent.tagName)) {
               if(blockParent.parentElement) blockParent = blockParent.parentElement;
               else break;
            }
            if (blockParent) blockParent.insertAdjacentHTML('beforeend', chatHtml);
            else el.insertAdjacentHTML('afterend', chatHtml);
            break;
          }
        }
      }

      const printCss = `
        <style>
          @page { size: landscape; margin: 0; }
          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
          }
          ::-webkit-scrollbar { display: none; }
        </style>
      `;
      doc.head.insertAdjacentHTML("beforeend", printCss);

      const blob = new Blob([doc.documentElement.outerHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");

      if (!printWindow) {
        alert("⚠️ O navegador bloqueou a aba de impressão. Permita pop-ups.");
        setGerandoPdfId(null);
        return;
      }

      printWindow.onload = () => {
        setTimeout(() => { printWindow.print(); }, 1000);
      };

    } catch (err) {
      console.error(err);
      alert("❌ Erro ao organizar o Dossiê Executivo.");
    } finally {
      setGerandoPdfId(null);
    }
  };

  const formatarDataLocal = (dataStr: string) => {
    if (!dataStr) return "-";
    const limpa = dataStr.trim();
    const dt = limpa.length === 10 ? new Date(`${limpa}T12:00:00`) : new Date(limpa);
    return dt.toLocaleDateString("pt-BR");
  };

  const historicoFiltrado = historico.filter((item) => {
    const nomeEmpresa = item.empresa_nome || "";
    if (busca.trim() !== "") {
      return nomeEmpresa.toLowerCase().includes(busca.toLowerCase());
    }
    const bateMes = mesesSel.length === 0 || mesesSel.includes(item._mesRef);
    const bateCed = cedentesSel.length === 0 || cedentesSel.includes(simplificarNome(nomeEmpresa));
    return bateMes && bateCed;
  });

  const somaDias = historicoFiltrado.reduce((acc, curr) => acc + curr._sla, 0);
  const mediaSLA = historicoFiltrado.length > 0 ? (somaDias / historicoFiltrado.length).toFixed(1) : "0.0";
  const aprovados = historicoFiltrado.filter(i => (i.status || "").toLowerCase().includes("aprovado")).length;
  const recusados = historicoFiltrado.filter(i => ["reprovado", "recusado", "rejeitado"].some(s => (i.status || "").toLowerCase().includes(s))).length;

  const cedentesFiltradosPelaBusca = listaCedentes.filter(ced => ced.toLowerCase().includes(termoBuscaCedente.toLowerCase()));
  const todosFiltradosAtivos = cedentesFiltradosPelaBusca.length > 0 && cedentesFiltradosPelaBusca.every(c => cedentesSel.includes(c));
  const handleToggleTodosFiltrados = () => {
    if (todosFiltradosAtivos) setCedentesSel(cedentesSel.filter(c => !cedentesFiltradosPelaBusca.includes(c)));
    else setCedentesSel(Array.from(new Set([...cedentesSel, ...cedentesFiltradosPelaBusca])));
  };

  function modoConsultaFocoAtivarModo(item: any) {
    ativarModoConsultaFoco(item);
  }

  // 🔮 INTERFACE 1: MODO CONSULTA EXECUTIVO TELA CHEIA ATIVO
  if (modoFocoConsulta && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];
    const htmlPreview = htmlPreviewsInline[empresaFocoAtivo.id];
    const isGerando = gerandoPdfId === empresaFocoAtivo.id;
    const isStatusPositivo = (empresaFocoAtivo.status || "").toLowerCase().includes("aprovado");

    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px] animate-in fade-in duration-200">
        <div className="bg-slate-950 text-white p-3 px-6 flex justify-between items-center shadow-lg border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xl">🗂</span>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Consulta de Dossiê Arquivado</span>
              <h2 className="text-base font-black uppercase text-white tracking-wide">{empresaFocoAtivo.empresa_nome}</h2>
            </div>
            <span className={`ml-2 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded border ${
              isStatusPositivo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}>
              {empresaFocoAtivo.status || "Finalizado"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => baixarPdfAnalise(empresaFocoAtivo)} 
              disabled={isGerando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isGerando ? "⏳ Extraindo HTML..." : "🖨️ Imprimir Dossiê"}
            </button>
            <button 
              onClick={desativarModoConsultaFoco} 
              className="px-4 py-2 bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-black text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer"
            >
              ✕ Fechar Tela
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden w-full bg-slate-900">
          <div className="w-[70%] h-full p-4 border-r border-slate-800 flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
              {htmlPreview ? (
                <iframe srcDoc={htmlPreview} className="w-full h-full border-0 bg-slate-50" sandbox="allow-scripts allow-same-origin" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 italic text-xs gap-3 font-mono">
                  <span className="animate-spin text-2xl">⏳</span>
                  Renderizando HTML estruturado...
                </div>
              )}
            </div>
          </div>

          <div className="w-[30%] h-full p-4 flex flex-col space-y-4 bg-slate-900">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left relative">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-2 flex items-center gap-2">
                📋 Votos Registrados
              </span>
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {listaDeVotos.length === 0 ? (
                  <p className="text-slate-600 italic text-xs py-10 text-center font-bold">Nenhum voto lançado em comitê para esta análise.</p>
                ) : (
                  listaDeVotos.map((v: any, idx: number) => {
                    const isVotoPositivo = (v.voto || "").toLowerCase().includes("aprov");
                    return (
                      <div key={idx} className="p-3 border border-slate-800/80 rounded-lg bg-slate-900 flex flex-col gap-2 shadow-xs transition-colors hover:border-slate-700">
                        <div className="flex justify-between items-start font-bold">
                          <span className="text-blue-400 text-xs tracking-wide">{v.membro_nome}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider border ${
                            isVotoPositivo ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            {v.voto}
                          </span>
                        </div>
                        <span className="text-slate-300 text-xs leading-relaxed italic">"{v.justificativa}"</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left relative">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-2 flex items-center gap-2">
                💬 Atas e Alinhamentos Finais
              </span>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-slate-600 py-10 text-xs italic font-bold">Nenhuma discussão registada.</p>
                ) : (
                  chatMsgs.map((m: any) => (
                    <div key={m.id} className="bg-slate-900 p-3 rounded-lg border border-slate-800/60 shadow-xs flex flex-col gap-1 hover:border-slate-700 transition-colors">
                      <span className="font-black text-[10px] text-slate-400 uppercase tracking-wider">{m.usuario}</span>
                      <span className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap break-words">{m.mensagem}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        `}} />
      </div>
    );
  }

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse text-xs uppercase tracking-widest">A varrer arquivo histórico do comitê...</div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 text-[13px] font-sans text-slate-700">
      <div className="hidden">{avisoCopia && "Copiado!"}</div>
      
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight uppercase">📚 Arquivo do Comitê (Finalizados)</h2>
          <span className="text-xs text-slate-500 font-medium">Consulte relatórios antigos, votos e prazos de SLA das análises já encerradas.</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div ref={refMes} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Mês de Recebimento:</label>
          <button onClick={() => setOpenMes(!openMes)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors shadow-sm">
            <span className="truncate">{mesesSel.length === 0 ? "Todos os Meses (Histórico Geral)" : mesesSel.length === listaMeses.length ? "Todos os Meses Selecionados" : `${mesesSel.length} Meses Selecionados`}</span>
            <span className="text-slate-400">▼</span>
          </button>
          {openMes && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 max-h-64 overflow-y-auto">
              <button onClick={() => setMesesSel(mesesSel.length === listaMeses.length ? [] : listaMeses)} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2 border-b border-slate-100 mb-1">
                {mesesSel.length === listaMeses.length ? "🔲 Desmarcar Todos" : "☑️ Selecionar Todos"}
              </button>
              {listaMeses.map(mes => (
                <label key={mes} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={mesesSel.includes(mes)} onChange={() => setMesesSel(mesesSel.includes(mes) ? mesesSel.filter(m => m !== mes) : [...mesesSel, mes])} className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                  {mes}
                </label>
              ))}
            </div>
          )}
        </div>

        <div ref={refCed} className="relative">
          <label className="block font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-2">Filtrar por Cedentes:</label>
          <button onClick={() => setOpenCedente(!openCedente)} className="w-full text-left p-2.5 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 font-bold text-xs flex justify-between items-center outline-none transition-colors shadow-sm">
            <span className="truncate">{cedentesSel.length === 0 || cedentesSel.length === listaCedentes.length ? "Todos os Cedentes" : `${cedentesSel.length} Selecionados`}</span>
            <span className="text-slate-400">▼</span>
          </button>
          {openCedente && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 flex flex-col gap-2 max-h-72">
              <input 
                type="text"
                placeholder="🔎 Digite para pesquisar..."
                value={termoBuscaCedente}
                onChange={(e) => setTermoBuscaCedente(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md outline-none text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold bg-slate-50 shadow-inner"
              />
              <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
                <button type="button" onClick={handleToggleTodosFiltrados} className="w-full text-left text-[11px] font-black text-blue-600 uppercase pb-2 border-b border-slate-100 mb-1 block">
                  {todosFiltradosAtivos ? "🔲 Limpar Resultados" : "☑️ Marcar Resultados"}
                </button>
                {cedentesFiltradosPelaBusca.map(ced => (
                  <label key={ced} className="flex items-center gap-2.5 font-bold text-slate-700 text-xs cursor-pointer p-1 hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={cedentesSel.includes(ced)} onChange={() => setCedentesSel(cedentesSel.includes(ced) ? cedentesSel.filter(c => c !== ced) : [...cedentesSel, ced])} className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                    {ced}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-6 rounded-xl text-center shadow-md flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Total de Análises</span>
          <div className="text-3xl font-black font-mono mt-1.5">{historicoFiltrado.length}</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-xl text-center shadow-xs flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-[10px] font-black text-emerald-600 block uppercase tracking-wider">Aprovados</span>
          <div className="text-3xl font-black font-mono text-emerald-700 mt-1.5">{aprovados}</div>
        </div>
        <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-xl text-center shadow-xs flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-[10px] font-black text-rose-600 block uppercase tracking-wider">Recusados / Reprov.</span>
          <div className="text-3xl font-black font-mono text-rose-700 mt-1.5">{recusados}</div>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-xl text-center shadow-xs flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-[10px] font-black text-blue-600 block uppercase tracking-wider">SLA Médio (Dias Úteis)</span>
          <div className="text-3xl font-black font-mono text-blue-700 mt-1.5">
            {mediaSLA} <span className="text-sm font-sans font-bold text-blue-400">{parseFloat(mediaSLA) === 1 ? "dia" : "dias"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-3 pt-4">
        <h2 className="text-xs font-black text-slate-500 tracking-wider uppercase">📋 Registros Filtrados da Carteira</h2>
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔎</span>
          <input 
            type="text" 
            placeholder="Buscar empresa diretamente..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-bold text-xs text-slate-700 shadow-xs"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 h-12">
                <th className="p-4 w-72">Empresa / Cedente</th>
                <th className="p-4 text-center w-36">Recebimento</th>
                <th className="p-4 text-center w-36">Envio Comitê</th>
                <th className="p-4 text-center w-32 bg-blue-50/50 text-blue-700 border-l border-r border-blue-100/50">⏳ SLA Útil</th>
                <th className="p-4 text-center w-36">Resultado</th>
                <th className="p-4 text-center w-56">Ações Executivas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-10 text-slate-400 font-bold italic">
                    Nenhum registro histórico atende aos filtros atuais para você.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((item) => {
                  const statusStr = (item.status || "").toLowerCase();
                  const eAprovado = statusStr.includes("aprovado") || statusStr.includes("finalizado");
                  const editando = linhaEditando === item.id;
                  const isGerando = gerandoPdfId === item.id;

                  return (
                    <tr key={item.id} className={`${editando ? "bg-amber-50/30" : "hover:bg-slate-50/70"} transition-colors`}>
                      <td className="p-4 font-black text-slate-900 truncate max-w-[280px] uppercase" title={item.empresa_nome}>
                        {item.empresa_nome}
                      </td>
                      
                      <td className="p-4 text-center text-slate-500">
                        {editando ? (
                          <input type="date" value={editDataRec} onChange={(e) => setEditDataRec(e.target.value)} className="w-full p-1.5 border border-slate-300 rounded text-[11px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 font-bold bg-white uppercase shadow-sm" />
                        ) : (
                          formatarDataLocal(item.data_recebimento)
                        )}
                      </td>

                      <td className="p-4 text-center text-slate-500">
                        {editando ? (
                          <input type="date" value={editDataEnvio} onChange={(e) => setEditDataEnvio(e.target.value)} className="w-full p-1.5 border border-slate-300 rounded text-[11px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 font-bold bg-white uppercase shadow-sm" />
                        ) : (
                          formatarDataLocal(item.criated_em || item.criado_em)
                        )}
                      </td>

                      <td className="p-4 text-center font-black font-mono text-blue-700 bg-blue-50/20 border-l border-r border-blue-50">
                        {item._sla} d
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-black rounded border uppercase tracking-wider shadow-xs ${
                          eAprovado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {item.status || "Finalizado"}
                        </span>
                      </td>
                      
                      <td className="p-4 flex gap-2 justify-center">
                        {editando ? (
                          <>
                            <button onClick={() => salvarEdicao(item.id)} disabled={salvandoEdicao} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50">
                              {salvandoEdicao ? "⏳" : "💾 Salvar"}
                            </button>
                            <button onClick={() => setLinhaEditando(null)} disabled={salvandoEdicao} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => iniciarEdicao(item)} 
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors shadow-sm" 
                              title="Corrigir datas de entrada e saída manualmente"
                            >
                              ✏️ Datas
                            </button>
                            <button 
                              onClick={() => modoConsultaFocoAtivarModo(item)} 
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors shadow-md flex items-center gap-1"
                            >
                              <span className="text-[12px] leading-none">🏛️</span> Analisar
                            </button>
                            <button 
                              onClick={() => baixarPdfAnalise(item)} 
                              disabled={isGerando}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
                            >
                              {isGerando ? "⏳..." : "📥 Dossiê"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}