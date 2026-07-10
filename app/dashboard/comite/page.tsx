/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// FUNÇÕES AUXILIARES E GERADOR DO DOSSIÊ HTML (INLINE)
// ============================================================================
const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
};

const montarHtmlDossie = (item: any) => {
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
        return `
        <tr>
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
    ? analise.empresas_grupo.map((e: any) => `
      <tr>
          <td style="font-weight:600; font-size:0.85rem;">${e.empresa || '-'}</td>
          <td style="font-size:0.85rem;" class="font-mono">${e.cnpj || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.fundacao || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.idade || '-'}</td>
      </tr>`).join("") 
    : `<tr><td colspan="4" class="text-center" style="color:var(--muted);">Nenhuma empresa informada.</td></tr>`;

  const socioRows = analise.socios && analise.socios.length > 0 
    ? analise.socios.map((s: any) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
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
        return `
          <tr>
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
        return `
        <tr>
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
        return `
        <tr>
            <td style="font-weight:600;">${r.empresa_socio || '-'}</td>
            <td style="color:var(--yellow); font-weight:bold;">${r.restritivo || '-'}</td>
            <td class="text-center font-mono">${r.qtd || 1}</td>
            <td class="text-right font-bold font-mono text-red-600">${formatarMoeda(r.valor)}</td>
        </tr>`;
    }).join("") : ``;

  const refRows = analise.referencias && analise.referencias.length > 0
    ? analise.referencias.map((r: any) => `
      <tr>
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
    
    return `
    <tr>
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

  return `
  <!DOCTYPE html>
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
          
          .hover-card { transition: box-shadow 0.3s; }
          .hover-card:hover { box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
          .expandable-box { position: relative; max-height: 90px; overflow: hidden; transition: max-height 0.6s ease-in-out; }
          .expandable-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 50px; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1) 90%); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; font-size: 0.75rem; font-weight: 800; color: var(--blue); transition: opacity 0.3s; }
          .expandable-fade::after { content: "Passar o mouse para expandir ▼"; }
          
          .hover-card:hover .expandable-box { max-height: 2000px; }
          .hover-card:hover .expandable-fade { opacity: 0; pointer-events: none; }
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
              <div class="metric-label" style="color:var(--blue-dark);">Rating Sugerido</div>
              <div class="metric-value" style="color: var(--yellow); text-align:center; font-size: 1.8rem;">${analise.rating || '-'}</div>
          </div>
          <div class="card" style="grid-column: span 2;">
              <div class="metric-label" style="margin-bottom: 0.5rem;">Resumo Executivo (Visita Comercial)</div>
              <div style="font-size: 0.9rem; color: #475569; line-height: 1.6; text-align: justify; white-space: pre-wrap;">${analise.resumo_visita || 'Sem resumo cadastrado.'}</div>
          </div>
      </div>

      <h2>1. Propostas e Condições Comerciais</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Modalidade</th><th class="text-right">Limite</th><th class="text-center">Prazo Médio</th><th class="text-center">Tranche</th><th class="text-center">Taxa</th><th>Garantia</th></tr></thead>
              <tbody>
                  ${propostasRows}
                  ${totalLimites > 0 ? `
                  <tr class="row-total">
                      <td>LIMITE TOTAL SOLICITADO</td>
                      <td class="text-right" style="color:var(--blue-dark); font-size: 1rem;">${formatarMoeda(totalLimites)}</td>
                      <td colspan="4"></td>
                  </tr>` : ''}
              </tbody>
          </table>
      </div>

      <h2>2. Background da Empresa & Societário</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Empresa (Grupo Econômico)</th><th>CNPJ</th><th class="text-center">Fundação</th><th class="text-center">Idade</th></tr></thead>
              <tbody>
                  ${empresasRows}
              </tbody>
          </table>
      </div>

      <div class="grid-2">
          <div class="card" style="margin-bottom:0;">
              <div class="metric-label">Localização & Ramo de Atividade</div>
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text);">${analise.localizacao || '-'}<br><span style="font-weight:500; font-size:0.85rem; color:var(--muted);">${analise.ramo || '-'}</span></div>
              <div style="font-size:0.8rem; color:var(--muted); margin-top:1rem; padding-top:1rem; border-top: 1px solid #f1f5f9;">
                  Site: <strong style="color:var(--blue);">${analise.site || 'Não Informado'}</strong> <br> Balanço Auditado: <strong>${analise.balanco_auditado || 'Não'}</strong>
              </div>
          </div>
          <div class="card" style="margin-bottom:0;">
              <div class="metric-label">Quadro Societário & Assinaturas</div>
              <table style="width:100%; font-size: 0.85rem; border-collapse: collapse;">
                  ${socioRows}
              </table>
              <div style="font-size:0.8rem; color:var(--muted); margin-top:1rem; padding-top:1rem; border-top: 1px solid #f1f5f9;">
                  Regra de Assinatura: <strong>${analise.regra_assinatura || '-'}</strong> <br> Aval Societário: <strong>${analise.aval_societario || '-'}</strong>
              </div>
          </div>
      </div>

      <div class="grid-2" style="margin-top: 1.5rem;">
          <div class="card" style="padding:0; overflow:hidden; position:relative; border: 1px solid #cbd5e1;">
              <div style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.95); padding:6px 12px; border-radius:6px; font-size:0.75rem; font-weight:800; z-index:10; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: var(--blue-dark); text-transform: uppercase;">Satélite</div>
              <iframe width="100%" height="300" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${enderecoQuery}&t=k&z=18&output=embed" allowfullscreen></iframe>
          </div>
          
          <div class="card" style="padding: 2rem; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#f8fafc; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">📍</div>
              <div style="font-weight: 800; color: var(--blue-dark); margin-bottom: 0.5rem; font-size: 1.2rem;">Endereço Mapeado</div>
              <div style="font-size: 0.9rem; color: var(--text); font-weight: 500; margin-bottom: 2rem; max-width: 90%; line-height: 1.5;">${localizacaoReal}</div>
              
              <div style="display: flex; gap: 1rem; width: 100%; justify-content: center; flex-wrap: wrap;">
                  <a href="https://www.google.com/maps/search/?api=1&query=${enderecoQuery}" target="_blank" class="btn-maps">🗺️ Ver no Mapa Externo</a>
                  <a href="https://www.google.com/maps?q=${enderecoQuery}&layer=c" target="_blank" class="btn-maps" style="background: #16a34a;">🚶‍♂️ Street View Interativo</a>
              </div>
          </div>
      </div>

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

      <h2 style="margin-top: 3.5rem;">3. Organograma / Teia Societária</h2>
      <div style="margin-bottom: 2.5rem;">
          ${analise.organograma_json && analise.organograma_json.nodes && analise.organograma_json.nodes.length > 0 ? `
          <div class="card" style="padding:1rem;">
              <div id="network-container" class="org-container"></div>
          </div>
          ` : analise.anexos?.organograma_url ? `
          <div class="card" style="padding: 1.5rem; display:flex; justify-content:center; background: #f8fafc;">
              <img src="${analise.anexos.organograma_url}" style="max-width: 100%; max-height: 600px; object-fit: contain; border-radius: 0.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          </div>
          ` : `
          <div class="card" style="display:flex; justify-content:center; align-items:center; height:150px; color:var(--muted); font-weight:700; background: #f8fafc; border: 1px dashed #cbd5e1;">[NENHUM ORGANOGRAMA VINCULADO]</div>
          `}
      </div>

      ${totalPatrimonio > 0 ? `
      <h3 style="color: var(--blue-dark); text-transform: uppercase; font-size: 0.9rem; font-weight: 800; margin-top: 2rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">Patrimônio Declarado (Bens IRPF)</h3>
      <div class="table-wrap">
          <table>
              <tbody>
                  ${patrimonioRows}
                  <tr class="row-total">
                      <td>TOTAL PATRIMÔNIO AVALIADO</td>
                      <td class="text-right" style="color:var(--green); font-size: 1rem;">${formatarMoeda(totalPatrimonio)}</td>
                  </tr>
              </tbody>
          </table>
      </div>
      ` : ''}

      <h2>4. Faturamento Consolidado</h2>
      <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
          <div class="metric-label" style="margin-bottom: 1rem;">Evolução de Faturamento Anual (YoY)</div>
          <div class="chart-container"><canvas id="fatChart"></canvas></div>
      </div>
      
      <div class="table-wrap">
          <table>
              <thead>
                  <tr>
                      <th>Mês</th>
                      <th class="text-center">Realizado 2026</th>
                      <th class="text-center">Variação (%)</th>
                      <th class="text-center">Realizado 2025</th>
                      <th class="text-center">Variação (%)</th>
                      <th class="text-center">Realizado 2024</th>
                      </tr>
              </thead>
              <tbody>
                  ${fatRows}
                  <tr class="row-total">
                      <td>TOTAL ANUAL</td>
                      <td class="text-center" style="color:var(--blue-dark);">${formatarMoeda(tot2026)}</td>
                      <td class="text-center">--</td>
                      <td class="text-center">${formatarMoeda(tot2025)}</td>
                      <td class="text-center">--</td>
                      <td class="text-center">${formatarMoeda(tot2024)}</td>
                  </tr>
                  <tr class="row-total" style="background:#f8fafc; border-top: 1px solid var(--border);">
                      <td>MÉDIA DO PERÍODO</td>
                      <td class="text-center">${formatarMoeda(med2026)}</td>
                      <td class="text-center">--</td>
                      <td class="text-center">${formatarMoeda(med2025)}</td>
                      <td class="text-center">--</td>
                      <td class="text-center">${formatarMoeda(med2024)}</td>
                  </tr>
              </tbody>
          </table>
      </div>

      <h2>5. Potencial de Negócios</h2>
      <div class="grid-2">
          <div class="card" style="margin-bottom:0;">
              <div class="metric-label">Parâmetros de Rotação de Recebíveis</div>
              <div style="font-size:0.9rem; margin-bottom:0.75rem;">Ticket Médio Operado: <strong style="color:var(--text);">${formatarMoeda(analise.dados_potencial?.ticket_medio)}</strong></div>
              <div style="font-size:0.9rem; margin-bottom:0.75rem;">Prazo de Vendas (Duplicatas): <strong style="color:var(--text);">${analise.dados_potencial?.prazo_medio_dpls || '-'}</strong></div>
              <div style="font-size:0.9rem;">Divisão de Recebimento: <strong style="color:var(--blue);">${analise.dados_potencial?.forma_recebimento_prazo || 0}% a Prazo</strong></div>
          </div>
          <div class="card" style="margin-bottom:0; background:#f0fdf4; border: 1px solid #86efac; display:flex; flex-direction:column; justify-content:center; align-items:center;">
              <div class="metric-label" style="color:#166534;">Potencial Real Estimado (Giro de Ciclo)</div>
              <div class="metric-value" style="color:#15803d; font-size:2.2rem; margin-top:0.5rem;">${formatarMoeda(analise.dados_potencial?.potencial_estimado)}</div>
          </div>
      </div>

      <h2>6. Passivo Bancário / Endividamento (SCR Bacen)</h2>
      <div class="grid-3">
          <div class="table-wrap" style="grid-column: span 1; display:flex; flex-direction:column; margin-bottom:0;">
              <table style="flex-grow: 1;">
                  <thead><tr><th colspan="2" class="text-center">Resumo de Linhas</th></tr></thead>
                  <tbody>
                      <tr><td>Volume Curto Prazo</td><td class="text-right font-bold">${formatarMoeda(curtoPrazo)}</td></tr>
                      <tr><td>Volume Longo Prazo</td><td class="text-right font-bold">${formatarMoeda(longoPrazo)}</td></tr>
                      <tr><td>Volume Total Mapeado</td><td class="text-right font-bold" style="color:var(--red); font-size:1rem;">${formatarMoeda(totalBancosDet)}</td></tr>
                      <tr><td colspan="2" class="text-center" style="font-size:0.8rem; padding: 1.5rem; background:#f8fafc;">
                          Indicador de Alavancagem:<br>
                          <strong style="color:var(--text); font-size: 1.25rem;">${alavancagem} x Fat. Médio</strong>
                      </td></tr>
                  </tbody>
              </table>
          </div>
          
          <div class="card" style="grid-column: span 2; padding: 1.5rem; margin-bottom:0;">
              <div class="metric-label" style="margin-bottom: 1rem;">Distribuição das Dívidas por Credor</div>
              <div class="chart-container" style="height: 180px;"><canvas id="endivChart"></canvas></div>
          </div>
      </div>
      
      <div class="table-wrap" style="margin-top: 1.5rem;">
          <table>
              <thead><tr><th>Credor / Instituição Financeira</th><th>Modalidade Contratada</th><th class="text-right">Saldo Devedor Atual</th></tr></thead>
              <tbody>
                  ${bancoRows}
                  ${totalBancosDet > 0 ? `<tr class="row-total"><td colspan="2">TOTAL SCR SCRUTADO</td><td class="text-right" style="color:var(--red); font-size:1rem;">${formatarMoeda(totalBancosDet)}</td></tr>` : ''}
              </tbody>
          </table>
      </div>

      <h2>7. Referências e Fundos de Investimentos</h2>
      <div class="table-wrap">
          <table>
              <thead><tr><th>Fundo / Parceiro</th><th class="text-center">Desde</th><th class="text-center">Últ. Op</th><th class="text-right">Limite Global</th><th class="text-right">Risco Total</th><th class="text-center">Liq / Atraso</th><th class="text-center">Conc.(%)</th></tr></thead>
              <tbody>
                  ${refRows}
              </tbody>
          </table>
      </div>

      <h2>8. Apontamentos Restritivos e Análise Jurídica</h2>
      
      <div class="grid-2" style="margin-bottom: 1.5rem;">
          <div class="card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; border: 1px solid ${totalRestritivos > 0 ? '#fca5a5' : '#86efac'}; background: ${totalRestritivos > 0 ? '#fef2f2' : '#f0fdf4'};">
              <div class="metric-label" style="color: ${totalRestritivos > 0 ? '#991b1b' : '#166534'};">Volume Financeiro Restritivo</div>
              <div class="metric-value" style="color: ${totalRestritivos > 0 ? '#b91c1c' : '#15803d'}; font-size:2.2rem; margin-top:0.5rem;">${formatarMoeda(totalRestritivos)}</div>
          </div>
          <div class="card" style="display:flex; flex-direction:column; justify-content:center; align-items:center; border: 1px solid ${qtdRestritivos > 0 ? '#fde047' : '#86efac'}; background: ${qtdRestritivos > 0 ? '#fefce8' : '#f0fdf4'};">
              <div class="metric-label" style="color: ${qtdRestritivos > 0 ? '#854d0e' : '#166534'};">Quantidade de Ocorrências</div>
              <div class="metric-value" style="color: ${qtdRestritivos > 0 ? '#a16207' : '#15803d'}; font-size:2.2rem; margin-top:0.5rem;">${qtdRestritivos}</div>
          </div>
      </div>

      ${totalRestritivos > 0 || qtdRestritivos > 0 ? `
      <div class="table-wrap">
          <table>
              <thead><tr><th>Envolvido (Empresa/Sócio)</th><th>Tipo de Ocorrência</th><th class="text-center">Qtd</th><th class="text-right">Montante</th></tr></thead>
              <tbody>
                  ${restritivosRows}
              </tbody>
          </table>
      </div>
      ` : ''}

      <div class="grid-2">
          <div class="card hover-card" style="padding:1.5rem; border-left: 4px solid #fca5a5; cursor: pointer;">
              <div style="font-weight:800; font-size:0.85rem; color:var(--red); margin-bottom:1rem; text-transform:uppercase;">⚠️ Litígios e Processos Ativos</div>
              <div class="expandable-box">
                  <div style="font-size:0.9rem; color:#334155; white-space: pre-wrap; line-height: 1.6;">${analise.juridico_tramitacao || 'Nenhum apontamento judicial crítico localizado.'}</div>
                  <div class="expandable-fade"></div>
              </div>
          </div>
          
          <div class="card hover-card" style="padding:1.5rem; border-left: 4px solid #93c5fd; cursor: pointer;">
              <div style="font-weight:800; font-size:0.85rem; color:var(--blue-dark); margin-bottom:1rem; text-transform:uppercase;">🔍 Análise de Mídia e Compliance</div>
              <div class="expandable-box">
                  <div style="font-size:0.9rem; color:#334155; white-space: pre-wrap; line-height: 1.6;">${analise.noticias_midia || 'Nada consta em pesquisas de desabonadores digitais.'}</div>
                  <div class="expandable-fade"></div>
              </div>
          </div>
      </div>

      <div class="parecer-wrapper" style="margin-top: 3rem;">
          <div class="parecer-header">Parecer Técnico / Deliberação da Mesa de Risco</div>
          <div class="parecer-body">
              <span style="color: var(--blue-dark); font-weight: 800; font-size: 1.1rem; display:block; margin-bottom: 1rem;">
                  RECOMENDAÇÃO TÉCNICA: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}
              </span>
              
              <div style="margin-bottom: 1rem;">
                  <strong style="color: var(--blue-dark); font-size: 0.85rem; text-transform: uppercase;">Parecer do Analista:</strong><br/>
                  ${analise.parecer_analista || 'Sem parecer do analista preenchido.'}
              </div>

              ${analise.parecer_comite ? `
              <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                  <strong style="color: var(--blue-dark); font-size: 0.85rem; text-transform: uppercase;">Votos e Deliberação do Comitê:</strong><br/>
                  ${analise.parecer_comite}
              </div>
              ` : ''}
          </div>
          <div class="parecer-footer">Documento Oficial Emitido por: <strong style="color: var(--blue-dark);">${analise.analista || item.comercial || 'Analista de Crédito'}</strong></div>
      </div>

  </div>

  <script>
      const endivLabels = ${arrayEndivLabels};
      const endivData = ${arrayEndivData};
      
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
          options: { 
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { display: true, ticks: { callback: function(value) { return 'R$ ' + (value / 1000).toLocaleString('pt-BR') + 'k'; } } } }
          }
      });

      if(endivLabels.length > 0 && endivData.length > 0) {
          const ctxEndiv = document.getElementById('endivChart').getContext('2d');
          new Chart(ctxEndiv, {
              type: 'pie',
              data: {
                  labels: endivLabels,
                  datasets: [{
                      data: endivData,
                      backgroundColor: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#0d9488', '#ea580c', '#334155'],
                      borderWidth: 0
                  }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
          });
      }

      const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
      
      if (orgaJson && orgaJson.nodes && orgaJson.edges) {
          const container = document.getElementById('network-container');
          if (container) {
              const nodes = new vis.DataSet(orgaJson.nodes.map(n => {
                  let rawLabel = (n.data && n.data.label) ? n.data.label : (n.label || n.id || "Sem Nome");
                  
                  rawLabel = String(rawLabel).replace(/<[^>]*>?/gm, ''); 

                  const words = rawLabel.split(' ');
                  let lines = [];
                  let currentLine = '';
                  words.forEach(w => {
                      if ((currentLine + w).length > 12) {
                          if (currentLine.trim() !== '') lines.push(currentLine.trim());
                          currentLine = w + ' ';
                      } else {
                          currentLine += w + ' ';
                      }
                  });
                  if (currentLine.trim() !== '') lines.push(currentLine.trim());
                  
                  const finalLabel = lines.join(String.fromCharCode(10));

                  const bgColor = (n.style && n.style.backgroundColor) ? n.style.backgroundColor : '#2563eb';
                  const borderColor = (n.style && n.style.borderColor) ? n.style.borderColor : 'rgba(0,0,0,0.2)';

                  return {
                      id: n.id, 
                      label: finalLabel,
                      shape: 'circle',
                      margin: 15, 
                      font: { color: '#ffffff', size: 11, face: 'Inter', bold: true },
                      color: { 
                          background: bgColor, 
                          border: borderColor,
                          highlight: { background: bgColor, border: '#000000' }
                      },
                      borderWidth: 1.5,
                      shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 8, x: 0, y: 4 }
                  };
              }));

              const edges = new vis.DataSet(orgaJson.edges.map(e => {
                  const edgeColor = (e.style && e.style.stroke) ? e.style.stroke : '#94a3b8';
                  const isDashed = (e.style && e.style.strokeDasharray) ? true : false;
                  
                  return {
                      id: e.id, 
                      from: e.source || e.from, 
                      to: e.target || e.to,
                      label: e.label || '',
                      color: { color: edgeColor, highlight: edgeColor }, 
                      arrows: 'to',
                      font: { size: 10, color: '#475569', face: 'Inter', background: '#ffffff', strokeWidth: 0 },
                      dashes: isDashed,
                      width: 2
                  };
              }));
              
              new vis.Network(container, { nodes, edges }, {
                  layout: { randomSeed: 2 },
                  physics: {
                      solver: 'repulsion',
                      repulsion: { nodeDistance: 120, centralGravity: 0.1, springLength: 150 },
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

export default function ComitePage() {
  const [analises, setAnalises] = useState<any[]>([]);
  const [empresasAnalise, setEmpresasAnalise] = useState<any[]>([]); 
  const [carregando, setCarregando] = useState(true);
  
  // 🎛️ CONTROLES DE FOCO E EXPANSÃO INTEGRADA
  const [idEmpresaExpandida, setIdEmpresaExpandida] = useState<string | null>(null);
  const [modoFocoComite, setModoFocoComite] = useState(false);
  const [empresaFocoAtivo, setEmpresaFocoAtivo] = useState<any>(null);

  const [votosAoVivo, setVotosAoVivo] = useState<Record<string, any[]>>({});
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [diretoresBanco, setDiretoresBanco] = useState<string[]>([]);

  // Perfis de voto
  const [opcaoVoto, setOpcaoVoto] = useState("");
  const [justificativaVoto, setJustificativaVoto] = useState("");
  const [votoComoDecisao, setVotoComoDecisao] = useState(false); 
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  
  const [nomeNovaEmpresa, setNomeNovaEmpresa] = useState("");

  const [isMaster, setIsMaster] = useState(false);
  const [isDiretor, setIsDiretor] = useState(false); 
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("");

  const carregarDiretores = async () => {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("nome")
        .ilike("cargo", "Diretor");
      if (data) setDiretoresBanco(data.map(u => u.nome));
    } catch (err) {
      console.error("Erro ao buscar diretores:", err);
    }
  };

  const carregarVotosIniciais = useCallback(async (empresaNome: string) => {
    if (!empresaNome) return;
    const { data } = await supabase.from("votos").select("*").eq("empresa_nome", empresaNome);
    if (data) {
      setVotosAoVivo(prev => ({ ...prev, [empresaNome]: data }));
    }
  }, []);

  const carregarComite = async () => {
    try {
      setCarregando(true);
      const userStr = localStorage.getItem("intraned_user");
      
      let queryComite = supabase.from("analises").select("*");
      let queryEsteira = supabase.from("analises").select("*");

      if (userStr) {
        const user = JSON.parse(userStr);
        const cargoUser = String(user.cargo || user.perfil || "").trim().toLowerCase();

        // 🛡️ Filtro de escopo comercial blindado (ilike)
        if (cargoUser === "comercial" && user.nome) {
          queryComite = queryComite.ilike("comercial", `%${user.nome}%`);
          queryEsteira = queryEsteira.ilike("comercial", `%${user.nome}%`);
        }
      }
      
      // Carrega pauta ativa do comitê (Baseado na tabela "analises" -> status 'aberta')
      const { data: dataComite } = await queryComite.eq("status", "aberta").order("criado_em", { ascending: false });
      if (dataComite) {
        setAnalises(dataComite);
        for (const item of dataComite) {
          await carregarVotosIniciais(item.empresa_nome);
        }
      }

      // Carrega esteira operacional pendente 
      const { data: dataAnalise } = await queryEsteira.in("status", ["em_processamento_ia", "aguardando_docs"]).order("criado_em", { ascending: false });
      if (dataAnalise) setEmpresasAnalise(dataAnalise);

    } catch (err) {
      console.error("Erro ao carregar dados do comitê:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDiretores();
    carregarComite(); 

    try {
      const userStr = localStorage.getItem("intraned_user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setNomeUsuarioLogado(parsed.nome || "Membro Ned");
        
        const cargoLimpo = String(parsed.cargo || parsed.perfil || "").toLowerCase().trim();
        if (cargoLimpo === "master") setIsMaster(true);
        if (cargoLimpo === "diretor") setIsDiretor(true);
      }
    } catch (e) { console.error(e); }

    const canalVotos = supabase
      .channel("votos-live-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, (payload: any) => {
        const nomeEmp = payload.new?.empresa_nome || payload.old?.empresa_nome;
        if (nomeEmp) carregarVotosIniciais(nomeEmp);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalVotos);
    };
  }, [carregarVotosIniciais]);

  useEffect(() => {
    if (!idEmpresaExpandida) return;
    const empresaAlvo = analises.find(a => a.id === idEmpresaExpandida);
    if (!empresaAlvo) return;

    const canalChat = supabase
      .channel(`chat-live-${idEmpresaExpandida}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_comite", filter: `empresa_nome=eq.${empresaAlvo.empresa_nome}` }, (payload) => {
        setChatMsgs(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalChat);
    };
  }, [idEmpresaExpandida, analises]);

  const obter_emails_notificacao = async (empresaNome: string) => {
    const emails = new Set<string>();
    try {
      const { data: masters } = await supabase.from("usuarios").select("email").eq("cargo", "Master");
      masters?.forEach(m => m.email && emails.add(m.email));
    } catch {
      emails.add("diego@nedcapital.com.br");
    }
    return Array.from(emails).sort();
  };

  const dispararEmailResend = async (subject: string, html: string, listaEmails: string[]) => {
    if (!listaEmails.length) return;
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          from: "Sistema Ned <sistema@nedcapital.com.br>", 
          to: [listaEmails[0]], 
          cc: listaEmails.slice(1), 
          subject, 
          html 
        }),
      });
    } catch (err) { console.error("Erro na API de e-mail Resend:", err); }
  };

  const forcarDecisaoMaster = async (empresaItem: any, decisaoFinal: "Aprovado" | "Reprovado") => {
    const conf = confirm(`⚠️ DECISÃO EXECUTIVA: Deseja mover a empresa ${empresaItem.empresa_nome} para ${decisaoFinal}?`);
    if (!conf) return;

    try {
      setCarregando(true);
      const e = empresaItem.empresa_nome;

      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Decisão Executiva Master: Processo encerrado diretamente como [${decisaoFinal.toUpperCase()}] em ${new Date().toLocaleDateString('pt-BR')}.`;

      const { error } = await supabase
        .from("analises")
        .update({ 
          status: decisaoFinal.toLowerCase(),
          dados_consolidados: dcAtual 
        })
        .eq("id", empresaItem.id);

      if (error) throw error;

      const emailsAlvo = await obter_emails_notificacao(e);
      const htmlAta = `<html><body><h2>Ata de Comitê Encerrada: ${e}</h2><p>Veredito Final: <b>${decisaoFinal}</b></p></body></html>`;
      await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);

      alert(`✅ Orquestração concluída! Empresa movida para ${decisaoFinal}.`);
      if (modoFocoComite) desativarModoLupaExecutiva();
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro no painel Master: ${err.message}`);
    } finally { 
      setCarregando(false);
    }
  };

  const processarVotoWeb = async (empresaItem: any) => {
    if (!isMaster && !isDiretor) {
      alert("🚫 ACESSO NEGADO: Registro restrito a Diretores.");
      return;
    }
    if (!opcaoVoto || !justificativaVoto) {
      alert("Por favor, selecione o seu voto e preencha o parecer/justificativa.");
      return;
    }
    try {
      setEnviandoVoto(true);
      const e = empresaItem.empresa_nome;
      const autorDoVoto = (isMaster && votoComoDecisao) ? "Decisão" : nomeUsuarioLogado;

      await supabase.from("votos").insert({ 
        empresa_nome: e, 
        membro_nome: autorDoVoto, 
        voto: opcaoVoto, 
        justificativa: justificativaVoto, 
        email_enviado: autorDoVoto === "Decisão"
      });
      
      const { data: listaVotos } = await supabase.from("votos").select("*").eq("empresa_nome", e);
      const totalSim = listaVotos?.filter(v => v.voto === "Aprovado").length || 0;
      const totalNao = listaVotos?.filter(v => v.voto === "Reprovado").length || 0;
      
      const dcAtual = empresaItem.dados_consolidados || {};
      dcAtual.parecer_comite = `Placar do Comitê: ${totalSim} SIM / ${totalNao} NÃO. Detalhamento de Pareceres: ` + 
        listaVotos?.map(v => `[${v.membro_nome}: ${v.voto} - Parecer: ${v.justificativa}]`).join(" | ");

      let statusDestino = empresaItem.status;
      if (autorDoVoto === "Decisão") {
        statusDestino = opcaoVoto.toLowerCase();
      }

      const { error } = await supabase
        .from("analises")
        .update({ 
          dados_consolidados: dcAtual,
          status: statusDestino
        })
        .eq("id", empresaItem.id);

      if (error) throw error;
      
      if (autorDoVoto === "Decisão") {
        const emailsAlvo = await obter_emails_notificacao(e);
        const htmlAta = `<html><body><h2>Ata de Comitê Finalizada: ${e}</h2><p>Status Final: <b>${opcaoVoto}</b></p></body></html>`;
        await dispararEmailResend(`🏁 Comitê Finalizado: ${e}`, htmlAta, emailsAlvo);
        if (modoFocoComite) desativarModoLupaExecutiva();
      }
      
      alert(autorDoVoto === "Decisão" ? "🏁 Comitê encerrado e Ata salva!" : "🗳️ Seu voto foi computado e injetado no dossiê!");
      setJustificativaVoto(""); 
      setVotoComoDecisao(false);
      await carregarVotosIniciais(e);
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro ao computar voto: ${err.message}`);
    } finally { 
      setEnviandoVoto(false); 
    }
  };

  const handleCriarAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEmpresa.trim()) return;
    
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").insert({
        empresa_nome: nomeNovaEmpresa.trim().toUpperCase(),
        caminho_local: "INCLUSAO_MANUAL", // Requisito do novo schema NOT NULL
        cnpj: "00000000000000",
        status: "aguardando_docs"
      });
      if (error) throw error;
      setNomeNovaEmpresa("");
      await carregarComite();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleDeletarAnalise = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    try {
      setCarregando(true);
      const { error } = await supabase.from("analises").delete().eq("id", id);
      if (error) throw error;
      await carregarComite();
    } catch (err: any) { 
      alert(`❌ Erro: ${err.message}`);
    } finally { setCarregando(false); }
  };

  const activarModoLupaExecutiva = async (empresa: any) => {
    setEmpresaFocoAtivo(empresa);
    setIdEmpresaExpandida(empresa.id); 
    setModoFocoComite(true);
    
    try {
      const { data } = await supabase
        .from("chat_comite")
        .select("*")
        .eq("empresa_nome", empresa.empresa_nome)
        .order("id", { ascending: true });
      if (data) setChatMsgs(data);
    } catch (err) {
      console.error("Erro ao carregar chat:", err);
    }
  };

  const desativarModoLupaExecutiva = () => {
    setModoFocoComite(false);
    setEmpresaFocoAtivo(null);
    setIdEmpresaExpandida(null); 
    setChatMsgs([]);
  };

  const enviarMensagemChat = async (empresaNome: string) => {
    if (!novaMsg.trim()) return;
    const { data } = await supabase.from("chat_comite").insert({ 
      empresa_nome: empresaNome, 
      usuario: nomeUsuarioLogado || "Alyson (Web)", 
      mensagem: novaMsg.trim() 
    }).select();
    if (data) setChatMsgs([...chatMsgs, data[0]]);
    setNovaMsg("");
  };

  // 🔮 MODO COMITÊ TELA CHEIA ATIVO
  if (modoFocoComite && empresaFocoAtivo) {
    const listaDeVotos = votosAoVivo[empresaFocoAtivo.empresa_nome] || [];
    // Geração do dossiê HTML direto no client-side em tempo real
    const htmlInline = montarHtmlDossie(empresaFocoAtivo);

    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col font-sans h-screen w-screen overflow-hidden text-[13px]">
        <div className="bg-slate-950 text-white p-3 px-6 flex justify-between items-center shadow-lg border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black tracking-tight text-blue-400">🏛️ COMITÊ EXECUTIVO DE CRÉDITO:</span>
            <h2 className="text-base font-black uppercase text-white tracking-wide">{empresaFocoAtivo.empresa_nome}</h2>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded uppercase">{empresaFocoAtivo.status || "Em análise"}</span>
          </div>
          <div className="flex items-center gap-4">
            {isMaster && (
              <div className="flex gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-800 mr-2">
                <button onClick={() => forcarDecisaoMaster(empresaFocoAtivo, "Aprovado")} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded uppercase transition-all">✅ Aprovar</button>
                <button onClick={() => forcarDecisaoMaster(empresaFocoAtivo, "Reprovado")} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded uppercase transition-all">⛔ Reprovar</button>
              </div>
            )}
            <button onClick={desativarModoLupaExecutiva} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg shadow-sm transition-all cursor-pointer uppercase tracking-wider">
              ✕ Sair do Modo Comitê
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden w-full bg-slate-900">
          <div className="w-[70%] h-full p-4 border-r border-slate-800 flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-800 relative">
              {/* O IFRAME RENDERIZA O HTML GERADO ON THE FLY DA FUNÇÃO AUXILIAR! */}
              <iframe 
                srcDoc={htmlInline} 
                className="w-full h-full border-0 bg-white" 
                sandbox="allow-scripts allow-same-origin" 
              />
            </div>
          </div>

          <div className="w-[30%] h-full p-4 flex flex-col space-y-4 bg-slate-950/40">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3 shrink-0 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">🗳️ Painel de Voto</span>
                <span className="text-[11px] text-blue-400 font-bold bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">👤 {votoComoDecisao ? "Decisão Final" : nomeUsuarioLogado}</span>
              </div>
              
              {(!isMaster && !isDiretor) ? (
                <div className="p-3 bg-red-950/30 text-red-400 font-bold text-xs rounded border border-red-900/50">
                  🔒 Seu perfil atual ({nomeUsuarioLogado}) está mapeado como consulta/operacional. Voto bloqueado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <select value={opcaoVoto} onChange={(e) => setOpcaoVoto(e.target.value)} className="p-2 bg-slate-950 text-white border border-slate-800 rounded text-xs font-bold outline-none cursor-pointer">
                    <option value="">Selecione o seu Voto</option>
                    <option value="Aprovado">🟢 Aprovado</option>
                    <option value="Reprovado">🔴 Reprovado</option>
                  </select>

                  {isMaster && (
                    <label className="flex items-center gap-2 p-1 text-slate-300 font-bold text-xs bg-slate-950/50 rounded border border-slate-800/80 cursor-pointer hover:bg-slate-950 select-none">
                      <input type="checkbox" checked={votoComoDecisao} onChange={(e) => setVotoComoDecisao(e.target.checked)} className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-800" />
                      Assegurar este voto como a <span className="text-amber-400">Decisão Final</span>
                    </label>
                  )}

                  <textarea value={justificativaVoto} onChange={(e) => setJustificativaVoto(e.target.value)} placeholder="Justificativa ou parecer técnico do comitê..." className="w-full p-2 bg-slate-950 text-white border border-slate-800 rounded text-xs font-medium outline-none h-16 resize-none" />
                  <button onClick={() => processarVotoWeb(empresaFocoAtivo)} disabled={enviandoVoto} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer shadow-md">
                    {enviandoVoto ? "Computando Parecer..." : "Confirmar e Lançar Voto"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[11px] font-black text-slate-400 uppercase block tracking-wider mb-2">📋 Histórico de Pareceres</span>
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {listaDeVotos.length === 0 ? (
                  <p className="text-slate-500 italic text-xs py-8 text-center">Nenhum voto lançado em mesa.</p>
                ) : (
                  listaDeVotos.map((v: any, idx: number) => (
                    <div key={idx} className="p-2.5 border border-slate-800 rounded-lg bg-slate-950/60 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-200">{v.membro_nome}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black ${v.voto === "Aprovado" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>{v.voto}</span>
                      </div>
                      <span className="text-slate-400 italic font-medium">"{v.justificativa}"</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex-1 flex flex-col overflow-hidden text-left">
              <span className="text-[11px] font-black text-slate-400 uppercase block tracking-wider mb-2">💬 Mesa de Debates</span>
              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg p-2 space-y-2 bg-slate-950/40">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-slate-600 py-10 text-xs italic">Nenhum comentário registrado.</p>
                ) : (
                  chatMsgs.map((m: any) => (
                    <div key={m.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 text-xs">
                      <span className="font-bold text-blue-400">{m.usuario}</span>: <span className="text-slate-300 font-medium whitespace-pre-wrap break-words">{m.mensagem}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2 shrink-0">
                <input type="text" value={novaMsg} onChange={(e) => setNovaMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagemChat(empresaFocoAtivo.empresa_nome)} placeholder="Mensagem..." className="flex-1 p-2 bg-slate-950 text-white border border-slate-800 rounded-lg text-xs outline-none focus:border-blue-500 font-medium" />
                <button onClick={() => enviarMensagemChat(empresaFocoAtivo.empresa_nome)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 rounded-lg cursor-pointer transition-all">Mandar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🏛️ RENDERIZAÇÃO DA VISÃO PADRÃO
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 text-[13px]">
      {carregando && <div className="fixed inset-0 bg-white/40 z-50 flex items-center justify-center font-bold text-slate-500">Sincronizando esteira...</div>}
      
      <div className="space-y-2">
        <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">📋 Análises Em Comitê (Mesa V8)</h2>
          {isMaster && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded">⚡ Master Ativo</span>}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Empresa / Cedente</th>
                <th className="p-2.5">CNPJ</th>
                <th className="p-2.5 text-center">Entrada</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center">Ações Gerais</th>
                {isMaster && <th className="p-2.5 text-center bg-slate-100 text-slate-800 border-l border-slate-200">⚡ AÇÃO MASTER</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {analises.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-bold text-slate-900 uppercase">{item.empresa_nome}</td>
                  <td className="p-2.5 font-mono text-slate-500">{item.cnpj}</td>
                  <td className="p-2.5 text-center text-slate-500 font-mono">{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase ${item.status === 'aprovado' ? 'bg-green-50 text-green-700 border border-green-200' : item.status === 'reprovado' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{item.status}</span>
                  </td>
                  <td className="p-2.5 text-center">
                    <button onClick={() => activarModoLupaExecutiva(item)} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors uppercase tracking-wide">
                      🏛️ Entrar em Mesa
                    </button>
                  </td>
                  {isMaster && (
                    <td className="p-2.5 bg-slate-50 border-l border-slate-200 text-center space-x-2">
                      <button onClick={() => forcarDecisaoMaster(item, "Aprovado")} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded uppercase tracking-wider transition-all">✅ Aprovar</button>
                      <button onClick={() => forcarDecisaoMaster(item, "Reprovado")} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded uppercase tracking-wider transition-all">⛔ Reprovar</button>
                    </td>
                  )}
                </tr>
              ))}
              {analises.length === 0 && (
                <tr><td colSpan={isMaster ? 6 : 5} className="p-4 text-center text-slate-400 italic">Nenhuma análise em pauta na mesa com status "aberta".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">🔍 Esteira em Processamento Automático (IA / Docs)</h2>
          </div>
          <form onSubmit={handleCriarAnalise} className="flex gap-2 items-center">
            <input type="text" placeholder="Nome da Empresa..." value={nomeNovaEmpresa} onChange={(e) => setNomeNovaEmpresa(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-[240px] font-medium" />
            <button type="submit" className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer">➕ Nova Esteira</button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-400 text-xs tracking-wider">
                <th className="p-2.5">Empresa</th>
                <th className="p-2.5 font-center">CNPJ</th>
                <th className="p-2.5">Status Interno</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {empresasAnalise.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">Nenhuma esteira pendente de docs ou IA.</td></tr>
              ) : (
                empresasAnalise.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/40">
                      <td className="p-2.5 font-bold text-blue-900 uppercase">{item.empresa_nome}</td>
                      <td className="p-2.5 font-mono text-slate-500">{item.cnpj}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-black text-[10px] uppercase tracking-wider animate-pulse">{item.status}</span>
                      </td>
                      <td className="p-2.5 text-center space-x-1.5">
                        <button onClick={() => handleDeletarAnalise(item.id)} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded text-xs cursor-pointer hover:bg-rose-100">✕ Remover</button>
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