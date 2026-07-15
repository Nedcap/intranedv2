/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================================
// FUNÇÕES AUXILIARES E GERADOR DO DOSSIÊ HTML (INLINE)
// ============================================================================
const formatarMoeda = (valor: any) => {
  const num = Number(valor);
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

const montarHtmlDossie = (item: any) => {
  if (!item) return "";
  
  const analise = item.dados_consolidados || {};
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const empresaNome = item.empresa_nome || analise.razao_social || 'EMPRESA NÃO INFORMADA';
  const cnpjDoc = item.cnpj || analise.cnpj || '-';
  
  const localizacaoReal = analise.localizacao?.trim() || "Brasil";
  const enderecoQuery = encodeURIComponent(localizacaoReal);

  // ==========================================
  // CABEÇALHO: PRINCIPAL E COOBRIGADOS
  // ==========================================
  const renderizarCabecalhoEmpresas = () => {
    if (analise.empresas_principais && analise.empresas_principais.length > 0) {
      return analise.empresas_principais.map((emp: any, index: number) => `
        <div style="margin-bottom: 1rem;">
          <h1 style="font-size: ${index === 0 ? '2.2rem' : '1.4rem'}; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            ${emp.razao_social || 'EMPRESA NÃO INFORMADA'}
            <span style="font-size: 0.65rem; padding: 4px 10px; border-radius: 6px; background: ${index === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}; border: 1px solid rgba(255,255,255,0.3); vertical-align: middle; font-weight: 800; letter-spacing: 1px;">
              ${index === 0 ? 'PRINCIPAL' : 'COOBRIGADO'}
            </span>
          </h1>
          <div class="meta" style="font-family: monospace; font-size: 1rem; color: rgba(255,255,255,0.9);">CNPJ: ${emp.cnpj || 'Não informado'}</div>
        </div>
      `).join('');
    }
    // Fallback legado
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

  // ==========================================
  // 📸 GALERIA - LÊ A ARRAY 'todas_as_imagens_r2' 
  // ==========================================
  let fotosUnicas: string[] = [];
  
  if (item.todas_as_imagens_r2 && Array.isArray(item.todas_as_imagens_r2)) {
    fotosUnicas = item.todas_as_imagens_r2;
  } else {
    const imagensExtraidas = new Set<string>();
    const normalizarUrl = (u: any) => {
      if (typeof u !== 'string') return null;
      if (/\.(jpeg|jpg|gif|png|webp)/i.test(u)) return u.trim();
      return null;
    };
    if (analise.anexos?.todas_as_imagens) analise.anexos.todas_as_imagens.forEach((u: string) => { const validUrl = normalizarUrl(u); if(validUrl) imagensExtraidas.add(validUrl); });
    if (analise.galeria_urls) analise.galeria_urls.forEach((url: string) => { const validUrl = normalizarUrl(url); if(validUrl) imagensExtraidas.add(validUrl); });
    if (analise.anexos) {
      if (analise.anexos.galeria_urls) analise.anexos.galeria_urls.forEach((url: string) => { const validUrl = normalizarUrl(url); if(validUrl) imagensExtraidas.add(validUrl); });
      const fachada = normalizarUrl(analise.anexos.fachada_url); if (fachada) imagensExtraidas.add(fachada);
      const visita = normalizarUrl(analise.anexos.fotos_visita_url); if (visita) imagensExtraidas.add(visita);
    }
    if (Array.isArray(item.dados_documentos)) item.dados_documentos.forEach((url: string) => { const validUrl = normalizarUrl(url); if (validUrl) imagensExtraidas.add(validUrl); });
    fotosUnicas = Array.from(imagensExtraidas);
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
          :root { 
              --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; 
              --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; 
              --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; 
          }
          body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 2rem; font-size: 13px; line-height: 1.5; }
          .container { max-width: 1200px; margin: 0 auto; background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid var(--border); }
          
          .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 10px 30px -5px rgba(37, 99, 235, 0.3); margin-bottom: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; align-items: flex-start; }
          @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: stretch; } }
          .header h1 { margin: 0; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; line-height: 1.1;}
          .header .meta { font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem; font-weight: 500; }
          
          .badge-top { background: rgba(255,255,255,0.2); padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem; backdrop-filter: blur(8px); text-transform: uppercase; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap; text-align: center; width: 100%; box-sizing: border-box;}
          
          h2 { font-size: 1.35rem; font-weight: 900; color: var(--blue-dark); margin: 3rem 0 1.5rem 0; display: flex; align-items: center; gap: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.75rem;}
          h2::before { content: ""; display: inline-block; width: 6px; height: 1.35rem; background-color: var(--blue); border-radius: 4px; }
          
          .grid-2, .grid-3, .grid-4 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
          @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-4 { grid-template-columns: repeat(4, 1fr); } }
          
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
          
          .parecer-wrapper { background: white; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden; position: relative; margin-bottom: 2rem;}
          .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: var(--blue); }
          .parecer-header { background: #f8fafc; padding: 1.5rem 2.5rem; font-weight: 900; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 1.1rem; letter-spacing: 0.5px;}
          .parecer-body { padding: 2.5rem; font-size: 1.05rem; line-height: 1.8; color: #334155; white-space: pre-wrap; text-align: justify;}
          .parecer-footer { background: #f8fafc; padding: 1.25rem 2.5rem; border-top: 1px solid #e2e8f0; color: var(--muted); font-size: 0.9rem; font-weight: 700; text-align: right;}
          
          .btn-maps { background: var(--blue); color: white; padding: 12px 20px; border-radius: 0.5rem; text-decoration: none; font-size: 0.85rem; font-weight: 800; display: inline-block; transition: 0.2s; box-shadow: 0 4px 6px rgba(37,99,235,0.2); border: 1px solid rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 0.5px; }
          .btn-maps:hover { transform: translateY(-2px); box-shadow: 0 8px 15px rgba(37,99,235,0.3); }
          
          .org-container { width: 100%; height: 500px; border-radius: 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; }
          ul.simple-list { margin: 0; padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.6; color: var(--text); font-weight: 500;}
          
          .hover-card { transition: box-shadow 0.3s, transform 0.3s; }
          .hover-card:hover { box-shadow: 0 15px 30px -5px rgba(0,0,0,0.1); transform: translateY(-2px); }
          .expandable-box { position: relative; max-height: 90px; overflow: hidden; transition: max-height 0.6s ease-in-out; }
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
                  PARECER: ${analise.recomendacao_analista || 'EM ANÁLISE'}
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
                  Site Institucional: <strong style="color:var(--blue);">${analise.site || 'Não Informado'}</strong> <br> 
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
              <div class="expandable-box" style="max-height: 120px;">
                  <div style="font-size:0.95rem; color:#334155; white-space: pre-wrap; line-height: 1.7;">${analise.dados_juridico?.relatorio_completo || analise.juridico_tramitacao || 'Nenhum apontamento judicial crítico localizado nas raspagens.'}</div>
                  <div class="expandable-fade" style="height: 60px;"></div>
              </div>
          </div>
          
          <div class="card hover-card" style="padding:2rem; border-left: 6px solid #93c5fd; cursor: pointer; background: #fff;">
              <div style="font-weight:900; font-size:1rem; color:var(--blue-dark); margin-bottom:1rem; text-transform:uppercase;">🔍 Clipping Mídia / Reputação</div>
              <div class="expandable-box" style="max-height: 120px;">
                  <div style="font-size:0.95rem; color:#334155; white-space: pre-wrap; line-height: 1.7;">${analise.noticias_midia || 'Nada consta em pesquisas reputacionais desabonadoras ativas.'}</div>
                  <div class="expandable-fade" style="height: 60px;"></div>
              </div>
          </div>
      </div>

      <div class="print-break"></div>

      <div class="parecer-wrapper" style="margin-top: 3.5rem;">
          <div class="parecer-header">Parecer Técnico Formal - Mesa de Risco</div>
          <div class="parecer-body">
              <span style="color: var(--blue-dark); font-weight: 900; font-size: 1.3rem; display:block; margin-bottom: 1.5rem; text-decoration: underline; text-underline-offset: 4px;">
                  Veredito de Crédito: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}
              </span>
              
              <div style="margin-bottom: 1.5rem;">
                  <strong style="color: var(--blue-dark); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Justificativa do Analista:</strong><br/><br/>
                  <div style="background: #f8fafc; border: 1px solid var(--border); padding: 1.5rem; border-radius: 0.75rem;">
                    ${analise.parecer_analista || 'Sem parecer técnico elaborado para este dossiê.'}
                  </div>
              </div>

              ${analise.parecer_comite ? `
              <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px dashed #cbd5e1;">
                  <strong style="color: var(--blue-dark); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Deliberação Oficial do Comitê:</strong><br/><br/>
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 1.5rem; border-radius: 0.75rem; color: #1e3a8a; font-weight: 500;">
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
                      shape: 'box',
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

  // 🔥 VASCULHADOR R2 PARA O COMITÊ (Roda transparente no fundo)
  const vasculharImagensR2 = async (analiseItem: any) => {
    let prefixoPasta = `clientes/${analiseItem.id}/`; 
    
    // Descobre o prefixo pela primeira URL de documento
    if (analiseItem.dados_documentos && analiseItem.dados_documentos.length > 0) {
      try {
        const urlBase = new URL(analiseItem.dados_documentos[0]);
        const parts = urlBase.pathname.split('/'); 
        const idxClientes = parts.indexOf('clientes');
        if (idxClientes !== -1 && parts.length > idxClientes + 1) {
          prefixoPasta = `${parts[idxClientes]}/${parts[idxClientes + 1]}/`;
        }
      } catch(e) { /* ignora */ }
    }

    try {
      const res = await fetch('/api/listar-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: prefixoPasta })
      });
      if (res.ok) {
        const data = await res.json();
        const regexImagem = /\.(jpeg|jpg|gif|png|webp)/i;
        if (data.urls) {
          return data.urls.filter((url: string) => regexImagem.test(url));
        }
      }
    } catch (e) {
       console.error("Erro vasculhador R2", e);
    }
    return [];
  };

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
      
      // Carrega pauta ativa do comitê
      const { data: dataComite } = await queryComite.eq("status", "aberta").order("criado_em", { ascending: false });
      if (dataComite) {
        
        // 🚀 Injeta as fotos únicas de nuvem dentro do objeto ANTES de renderizar o comitê!
        const analisesComImagensR2 = await Promise.all(dataComite.map(async (item) => {
           const urlsR2 = await vasculharImagensR2(item);
           return { ...item, todas_as_imagens_r2: urlsR2 };
        }));

        setAnalises(analisesComImagensR2);
        for (const item of analisesComImagensR2) {
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
        caminho_local: "INCLUSAO_MANUAL", 
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