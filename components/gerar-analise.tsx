"use client";

import { useState } from "react";

export default function GerarAnalise({ analise }: { analise: any }) {
  const [gerando, setGerando] = useState(false);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  };

  const calcDelta = (at: number, ant: number) => {
    if (!ant || ant === 0) return "-";
    return (((at - ant) / ant) * 100).toFixed(1) + "%";
  };

  const gerarRelatorioHTML = () => {
    setGerando(true);

    try {
      // 1. DATA E VARIÁVEIS GERAIS
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const apiKeyMaps = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
      const enderecoQuery = encodeURIComponent(analise.localizacao || "São Paulo, SP");

      // 2. PROCESSAMENTO DE TABELAS (CONVERSÃO DE ARRAY PARA HTML)
      // Capa e Propostas
      let totalLimites = 0;
      const propostasRows = analise.propostas?.map((p: any) => {
        totalLimites += Number(p.limite) || 0;
        return `<tr>
          <td style="font-weight:600;">${p.modalidade || '-'}</td>
          <td class="text-right font-bold" style="color:var(--blue);">${formatarMoeda(p.limite)}</td>
          <td class="text-center">${p.prazo || '-'}</td>
          <td class="text-center">${p.tranche || '-'}</td>
          <td class="text-center font-bold">${p.taxa || '-'}</td>
          <td>${p.garantia || '-'}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="6" class="text-center" style="color:var(--muted);">Nenhuma proposta informada.</td></tr>`;

      // Empresas do Grupo
      const empresasRows = analise.empresas_grupo?.map((e: any) => `
        <tr>
          <td style="font-weight:600; font-size:0.85rem;">${e.empresa || '-'}</td>
          <td style="font-size:0.85rem;">${e.cnpj || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.fundacao || '-'}</td>
          <td style="font-size:0.85rem; text-align:center;">${e.idade || '-'}</td>
        </tr>
      `).join("") || `<tr><td colspan="4" class="text-center" style="color:var(--muted);">Nenhuma empresa informada.</td></tr>`;

      // Sócios
      const socioRows = analise.socios?.map((s: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 4px 0;"><strong>${s.nome || '-'}</strong></td>
          <td style="padding: 4px 0; color: var(--muted);">${s.funcao || 'Sócio'}</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${s.perc || 0}%</td>
        </tr>
      `).join("") || `<tr><td colspan="3" style="color:var(--muted); text-align:center; padding: 4px 0;">Nenhum sócio informado.</td></tr>`;

      // Patrimônio
      let totalPatrimonio = 0;
      const patrimonioRows = analise.patrimonios?.map((p: any) => {
        totalPatrimonio += Number(p.valor) || 0;
        return `<tr>
          <td style="font-weight:600;">${p.descricao || '-'} <span style="font-weight:normal; color:var(--muted);">(${p.socio})</span></td>
          <td class="text-right font-bold">${formatarMoeda(p.valor)}</td>
        </tr>`;
      }).join("");

      // Endividamento Detalhado e Resumo
      let totalBancosDet = 0;
      let curtoPrazo = 0;
      let longoPrazo = 0;
      const bancoRows = analise.endividamento_detalhado?.map((b: any) => {
        const val = Number(b.saldo) || 0;
        totalBancosDet += val;
        if (b.prazo === "Curto Prazo") curtoPrazo += val; else longoPrazo += val;
        return `<tr>
          <td style="font-weight:600; font-size:0.85rem;">${b.instituicao || '-'}</td>
          <td style="font-size:0.85rem;">${b.modalidade || '-'} (${b.prazo})</td>
          <td class="text-right font-bold" style="font-size:0.85rem;">${formatarMoeda(val)}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="3" class="text-center" style="color:var(--muted);">Nenhum detalhamento bancário mapeado.</td></tr>`;

      // Referências
      const refRows = analise.referencias?.map((r: any) => `
        <tr>
          <td style="font-weight:600; font-size:0.85rem;">${r.instituicao || '-'}</td>
          <td style="font-size:0.85rem;">${r.cliente_desde ? new Date(r.cliente_desde).toLocaleDateString('pt-BR') : '-'}</td>
          <td style="font-size:0.85rem;">${r.ultima_operacao ? new Date(r.ultima_operacao).toLocaleDateString('pt-BR') : '-'}</td>
          <td class="text-right font-bold text-blue-600" style="font-size:0.85rem;">${formatarMoeda(r.limite_global)}</td>
          <td class="text-right font-bold text-red-600" style="font-size:0.85rem;">${formatarMoeda(r.risco_total)}</td>
          <td class="text-center" style="font-size:0.85rem;">${r.liquidez_pontual || '-'}</td>
          <td class="text-right font-bold" style="font-size:0.85rem;">${r.recompra || '-'}</td>
        </tr>
      `).join("") || `<tr><td colspan="7" class="text-center" style="color:var(--muted);">Nenhuma referência bancária mapeada na planilha.</td></tr>`;

      // Restritivos
      let totalRestritivos = 0;
      let qtdRestritivos = 0;
      const restritivosRows = analise.restritivos?.map((r: any) => {
        totalRestritivos += Number(r.valor) || 0;
        qtdRestritivos += Number(r.qtd) || 0;
        return `<tr>
          <td style="font-weight:600; font-size:0.8rem;">${r.empresa_socio || '-'}</td>
          <td style="font-size:0.8rem;">${r.restritivo || '-'}</td>
          <td class="text-center">${r.qtd || 1}</td>
          <td class="text-right delta-neg">${formatarMoeda(r.valor)}</td>
        </tr>`;
      }).join("") || ``;

      // Faturamento Mensal
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

        const delta1 = calcDelta(val2025, val2024);
        const delta2 = calcDelta(val2026, val2025);
        
        return `<tr>
          <td style="font-weight: 600; text-transform: capitalize;">${mes}</td>
          <td class="text-center">${formatarMoeda(val2026)}</td>
          <td class="text-center ${delta2.includes('-') ? 'delta-neg' : delta2 !== '-' ? 'delta-pos' : ''}">${delta2}</td>
          <td class="text-center">${formatarMoeda(val2025)}</td>
          <td class="text-center ${delta1.includes('-') ? 'delta-neg' : delta1 !== '-' ? 'delta-pos' : ''}">${delta1}</td>
          <td class="text-center">${formatarMoeda(val2024)}</td>
        </tr>`;
      }).join("");

      const med2024 = qtd2024 > 0 ? tot2024 / 12 : 0;
      const med2025 = qtd2025 > 0 ? tot2025 / 12 : 0;
      const med2026 = qtd2026 > 0 ? tot2026 / 12 : 0;

      // Alavancagem
      const faturamentoReferencia = med2026 > 0 ? med2026 : (med2025 > 0 ? med2025 : med2024);
      const alavancagem = faturamentoReferencia > 0 ? (totalBancosDet / faturamentoReferencia).toFixed(2) : "0.00";

      // PREPARAÇÃO DE DADOS PARA GRÁFICOS (JSON)
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

      // HTML TEMPLATE - Igual ao Python
      const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório Executivo - ${analise.razao_social}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; font-size: 14px; }
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
        @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: center; } }
        .header h1 { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;}
        .header .meta { font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem; }
        .header .badge-top { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 600; font-size: 0.85rem; backdrop-filter: blur(4px); }

        h2 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 2.5rem 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; }
        h2::before { content: ""; display: inline-block; width: 4px; height: 1.25rem; background-color: var(--blue); border-radius: 2px; }
        
        .grid-2, .grid-3, .grid-4, .grid-6 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
        @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-4 { grid-template-columns: repeat(2, 1fr); } .grid-6 { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .grid-4 { grid-template-columns: repeat(4, 1fr); } .grid-6 { grid-template-columns: repeat(6, 1fr); } }
        
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); }
        .metric { margin-bottom: 1rem; }
        .metric-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
        .metric-value { font-size: 1.5rem; font-weight: 700; color: var(--text); }
        
        .table-wrap { overflow-x: auto; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
        .table-wrap table { width: 100%; border-collapse: collapse; text-align: left; }
        .table-wrap-large table { min-width: 600px; }
        
        th, td { padding: 0.875rem 1.5rem; border-bottom: 1px solid var(--border); }
        th { background: #f8fafc; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #f1f5f9; }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .delta-pos { color: var(--green); font-weight: 600; }
        .delta-neg { color: var(--red); font-weight: 600; }
        .row-total td { background: var(--bg); font-weight: 700; font-size: 0.95rem; }

        .chart-container { position: relative; height: 300px; width: 100%; }
        
        .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
        .bg-red { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
        .bg-yellow { background: #fefce8; color: #854d0e; border: 1px solid #fde047; }
        .bg-green { background: #f0fdf4; color: #166534; border: 1px solid #86efac; }
        
        .rest-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.5rem; text-align: center; padding: 1rem 0.5rem; }
        .rest-card .title { font-size: 0.7rem; font-weight: 700; color: #1e40af; text-transform: uppercase; }
        .rest-card .value { font-size: 1rem; font-weight: 800; color: #1e3a8a; margin-top: 0.25rem; }

        .kappi-box { background: #f8fafc; border-left: 4px solid var(--blue); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
        .org-container { width: 100%; height: 500px; border: 1px solid var(--border); border-radius: 0.5rem; background: #fafafa; overflow:hidden;}

        .img-box-orga { border-radius: 0.5rem; overflow: hidden; border: 1px solid var(--border); display: flex; justify-content: center; align-items: center; background: white; padding: 2rem; width: 100%;}
        .img-box-orga img { width: 100%; max-height: 500px; object-fit: contain; }

        .parecer-wrapper { background: white; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; position: relative; margin-bottom: 3rem;}
        .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--blue); }
        .parecer-header { background: #f8fafc; padding: 1rem 2rem; font-weight: 800; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;}
        .parecer-body { padding: 2rem; font-size: 1rem; line-height: 1.8; color: #334155; position: relative; white-space: pre-wrap; text-align: justify;}
        .parecer-footer { background: #f1f5f9; padding: 1rem 2rem; font-size: 0.85rem; font-weight: 600; color: var(--muted); border-top: 1px solid #e2e8f0; text-align: right; }
        
        .btn-maps { background: var(--blue); color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 700; display: inline-block; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.1); }
        .btn-maps:hover { filter: brightness(1.1); transform: translateY(-1px); }
        
        @media print { .print-break { page-break-before: always; } }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <div>
            <h1>${analise.razao_social}</h1>
            <div class="meta">CNPJ: ${analise.cnpj} | Data Análise: ${dataAtual} | Analista: ${analise.analista || '-'} | Gerente Comercial: ${analise.gerente || '-'}</div>
        </div>
        <div class="badge-top">STATUS: ${analise.status || 'EM ANÁLISE'}</div>
    </div>

    <h2>Proposta e Condições Comerciais</h2>
    <div class="table-wrap table-wrap-large">
        <table>
            <thead><tr><th>Modalidade</th><th class="text-right">Limite</th><th class="text-center">Prazo Médio</th><th class="text-center">Tranche</th><th class="text-center">Taxa</th><th>Garantia</th></tr></thead>
            <tbody>
                ${propostasRows}
                ${totalLimites > 0 ? `<tr class="row-total"><td>LIMITE TOTAL</td><td class="text-right" style="color:var(--blue-dark);">${formatarMoeda(totalLimites)}</td><td colspan="4"></td></tr>` : ''}
            </tbody>
        </table>
    </div>

    <div class="grid-3" style="margin-bottom: 1.5rem;">
        <div class="card" style="grid-column: span 1; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px dashed var(--blue);">
            <div class="metric-label" style="color:var(--blue-dark);">Rating Sugerido</div>
            <div class="metric-value" style="color: var(--yellow); text-align:center;">${analise.rating || '-'}</div>
        </div>
        <div class="card" style="grid-column: span 2;">
            <div class="metric-label" style="margin-bottom: 0.5rem;">Resumo Executivo (Visita)</div>
            <div style="font-size: 0.85rem; color: var(--muted); line-height: 1.5; text-align: justify; white-space: pre-wrap;">${analise.resumo_visita || 'Sem resumo cadastrado.'}</div>
        </div>
    </div>

    <h2>Background da Empresa & Societário</h2>
    <div class="grid-2">
        <div class="table-wrap" style="margin-bottom:0;">
            <table>
                <thead><tr><th>Empresa (Grupo Econômico)</th><th>CNPJ</th><th>Fundação</th><th>Idade</th></tr></thead>
                <tbody>
                    ${empresasRows}
                </tbody>
            </table>
        </div>
        <div class="card" style="margin-bottom:0;">
            <div class="metric">
                <div class="metric-label">Localização & Ramo</div>
                <div style="font-weight: 600; font-size: 0.9rem;">${analise.localizacao || '-'}<br><span style="font-weight:normal; font-size:0.8rem; color:var(--muted);">${analise.ramo || '-'}</span></div>
            </div>
            <div class="metric">
                <div class="metric-label">Quadro Societário</div>
                <table style="width:100%; font-size: 0.85rem; border-collapse: collapse; margin-bottom: 0.5rem;">
                    ${socioRows}
                </table>
                <div class="badge" style="background:#f1f5f9; color:var(--muted); font-size:0.65rem;">Assinatura: ${analise.regra_assinatura || '-'}</div>
                <div class="badge" style="background:#f1f5f9; color:var(--muted); font-size:0.65rem; margin-top:0.5rem;">Aval Societário: ${analise.aval_societario || '-'}</div>
            </div>
        </div>
    </div>

    <div class="grid-2" style="margin-top: 1.5rem;">
        <div class="card" style="padding:0; overflow:hidden; position:relative;">
            <div style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.9); padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">Visão de Satélite</div>
            ${apiKeyMaps 
              ? `<iframe width="100%" height="300" style="border:0" loading="lazy" allowfullscreen src="https://www.google.com/maps/embed/v1/place?key=${apiKeyMaps}&q=${enderecoQuery}"></iframe>`
              : `<iframe width="100%" height="300" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${enderecoQuery}&t=k&z=18&output=embed" allowfullscreen></iframe>`
            }
        </div>
        
        <div class="card" style="padding: 2rem; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#f8fafc; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📍</div>
            <div style="font-weight: 800; color: var(--blue-dark); margin-bottom: 0.5rem; font-size: 1.1rem;">Endereço Localizado</div>
            <div style="font-size: 0.85rem; color: var(--text); font-weight: 500; margin-bottom: 1.5rem; max-width: 90%; line-height: 1.5;">${analise.localizacao || 'Endereço não preenchido'}</div>
            
            <div style="display: flex; gap: 0.75rem; width: 100%; justify-content: center; flex-wrap: wrap;">
                <a href="https://www.google.com/maps/search/?api=1&query=${enderecoQuery}" target="_blank" class="btn-maps" style="background: var(--blue);">🗺️ Abrir Mapa Externo</a>
                <a href="https://www.google.com/maps?q=${enderecoQuery}&layer=c" target="_blank" class="btn-maps" style="background: #16a34a;">🚶‍♂️ Navegar no Street View</a>
            </div>
            
            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 1.5rem; font-style: italic;">* Utilize o botão verde para abrir a visão da rua interativa no Google Maps.</div>
        </div>
    </div>

    <h2 style="margin-top: 3rem;">Organograma / Fluxo Societário</h2>
    <div style="margin-bottom: 2rem;">
        ${analise.organograma_json && analise.organograma_json.nodes ? `
        <div class="card" style="padding:1rem;">
            <div id="network-container" class="org-container"></div>
        </div>
        ` : analise.anexos?.organograma_url ? `
        <div class="img-box-orga" style="cursor: pointer;" onclick="window.open(this.querySelector('img').src)">
            <img src="${analise.anexos.organograma_url}">
        </div>
        ` : `
        <div class="card" style="display:flex; justify-content:center; align-items:center; height:150px; color:var(--muted); font-weight:600;">[NENHUM ORGANOGRAMA ANEXADO OU MAPEDADO EM JSON]</div>
        `}
    </div>

    ${totalPatrimonio > 0 ? `
    <div class="table-wrap table-wrap-large" style="margin-top: 1.5rem;">
        <table>
            <thead><tr><th>Patrimônio Informado (Bens)</th><th class="text-right">Valor</th></tr></thead>
            <tbody>
                ${patrimonioRows}
                <tr class="row-total"><td>TOTAL PATRIMÔNIO DECLARADO</td><td class="text-right" style="color:var(--green);">${formatarMoeda(totalPatrimonio)}</td></tr>
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="print-break"></div>

    <h2>Faturamento Consolidado</h2>
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
        <div class="metric-label" style="margin-bottom: 1rem;">Evolução de Faturamento (YoY)</div>
        <div class="chart-container" style="height: 250px;"><canvas id="fatChart"></canvas></div>
    </div>
    
    <div class="table-wrap table-wrap-large">
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
                <tr class="row-total" style="border-top: 2px solid var(--border);">
                    <td>TOTAL ANO</td>
                    <td class="text-center">${formatarMoeda(tot2026)}</td>
                    <td class="text-center"></td>
                    <td class="text-center">${formatarMoeda(tot2025)}</td>
                    <td class="text-center"></td>
                    <td class="text-center">${formatarMoeda(tot2024)}</td>
                </tr>
                <tr class="row-total" style="background:#f1f5f9;">
                    <td>MÉDIA MENSAL GERAL</td>
                    <td class="text-center">${formatarMoeda(med2026)}</td>
                    <td class="text-center"></td>
                    <td class="text-center">${formatarMoeda(med2025)}</td>
                    <td class="text-center"></td>
                    <td class="text-center">${formatarMoeda(med2024)}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <h2>Potencial de Negócios</h2>
    <div class="grid-2">
        <div class="card" style="margin-bottom:0;">
            <div class="metric-label">Ticket e Prazos</div>
            <div style="font-size:0.9rem; margin-bottom:0.5rem;">Ticket Médio Operado: <strong>${formatarMoeda(analise.dados_potencial?.ticket_medio)}</strong></div>
            <div style="font-size:0.9rem; margin-bottom:0.5rem;">Prazo Médio de Vendas (Dias): <strong>${analise.dados_potencial?.prazo_medio_dpls || '-'}</strong></div>
            <div style="font-size:0.9rem;">Recebimento a Prazo Estimado: <strong>${analise.dados_potencial?.forma_recebimento_prazo || 0}%</strong></div>
        </div>
        <div class="card" style="margin-bottom:0; background:#f0fdf4; border-color:#86efac; display:flex; flex-direction:column; justify-content:center;">
            <div class="metric-label" style="color:#166534;">Potencial Real Estimado</div>
            <div class="metric-value" style="color:#15803d; font-size:2.5rem;">${formatarMoeda(analise.dados_potencial?.potencial_estimado)}</div>
        </div>
    </div>

    <div class="print-break"></div>

    <h2>Passivo Bancário / Endividamento</h2>
    <div class="grid-3">
        <div class="table-wrap" style="grid-column: span 1; display:flex; flex-direction:column; margin-bottom:0;">
            <table style="flex-grow: 1;">
                <thead><tr><th colspan="2" class="text-center">Resumo Consolidado</th></tr></thead>
                <tbody>
                    <tr><td>Curto Prazo</td><td class="text-right font-bold">${formatarMoeda(curtoPrazo)}</td></tr>
                    <tr><td>Longo Prazo</td><td class="text-right font-bold">${formatarMoeda(longoPrazo)}</td></tr>
                    <tr class="row-total"><td>TOTAL GERAL</td><td class="text-right" style="color:var(--red);">${formatarMoeda(totalBancosDet)}</td></tr>
                    <tr><td colspan="2" class="text-center" style="font-size:0.8rem; padding: 1rem; color:var(--muted);">
                        Alavancagem Atual:<br>
                        <strong style="color:var(--text); font-size: 1.1rem;">${alavancagem} x Faturamento Médio</strong>
                    </td></tr>
                </tbody>
            </table>
        </div>
        
        <div class="card" style="grid-column: span 2; padding: 1rem; margin-bottom:0;">
            <div class="metric-label" style="margin-bottom: 1rem;">Distribuição por Modalidade</div>
            <div class="chart-container" style="height: 200px;"><canvas id="endivChart"></canvas></div>
        </div>
    </div>
    
    <div class="table-wrap table-wrap-large" style="margin-top: 1.5rem;">
        <table>
            <thead><tr><th>Credor / Instituição</th><th>Modalidade e Prazo</th><th class="text-right">Saldo Devedor</th></tr></thead>
            <tbody>
                ${bancoRows}
                ${totalBancosDet > 0 ? `<tr class="row-total"><td colspan="2">TOTAL ENDIVIDAMENTO DETALHADO</td><td class="text-right" style="color:var(--red); font-size:0.95rem;">${formatarMoeda(totalBancosDet)}</td></tr>` : ''}
            </tbody>
        </table>
    </div>

    <h2>Referências e Informações Bancárias</h2>
    <div class="table-wrap table-wrap-large">
        <table>
            <thead><tr><th>Instituição / Banco</th><th>Cliente Desde</th><th>Última Operação</th><th class="text-right">Limite Global</th><th class="text-right">Risco Total</th><th class="text-center">Liquidez Pontual</th><th class="text-right">Recompra</th></tr></thead>
            <tbody>
                ${refRows}
            </tbody>
        </table>
    </div>

    <h2>Apontamentos Restritivos e Levantamento Jurídico</h2>
    <div class="grid-6" style="margin-bottom: 1.5rem;">
        <div class="rest-card"><div class="title">Pefin</div><div class="value">${analise.restritivos_quadro?.pefin || 0}</div></div>
        <div class="rest-card"><div class="title">Refin</div><div class="value">${analise.restritivos_quadro?.refin || 0}</div></div>
        <div class="rest-card"><div class="title">Protestos</div><div class="value">${analise.restritivos_quadro?.protesto || 0}</div></div>
        <div class="rest-card"><div class="title">Dívida Vencida</div><div class="value">${analise.restritivos_quadro?.div_vencida || 0}</div></div>
        <div class="rest-card"><div class="title">Ações Judiciais</div><div class="value">${analise.restritivos_quadro?.acao_judicial || 0}</div></div>
        <div class="rest-card"><div class="title">Chq s/ Fundo</div><div class="value">${analise.restritivos_quadro?.cheque_sem_fundo || 0}</div></div>
    </div>

    ${totalRestritivos > 0 ? `
    <div class="table-wrap table-wrap-large" style="margin-bottom:1.5rem;">
        <table>
            <thead><tr><th>Empresa / Sócio Envolvido</th><th>Restritivo</th><th class="text-center">Qtd</th><th class="text-right">Valor</th></tr></thead>
            <tbody>
                ${restritivosRows}
                <tr class="row-total"><td colspan="2">TOTAL CONSOLIDADO (${qtdRestritivos} apontamentos)</td><td colspan="2" class="text-right" style="color:var(--red);">${formatarMoeda(totalRestritivos)}</td></tr>
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="grid-2">
        <div class="kappi-box">
            <div class="metric-label" style="color:var(--blue-dark);">Levantamento Jurídico e Processos</div>
            <div style="font-size:0.85rem; color:#334155; line-height:1.6; white-space: pre-wrap;">${analise.juridico_tramitacao || 'Nenhum apontamento mapeado.'}</div>
        </div>
        <div class="kappi-box">
            <div class="metric-label" style="color:var(--blue-dark);">Notícias de Mídia e Reputação</div>
            <div style="font-size:0.85rem; color:#334155; line-height:1.6; white-space: pre-wrap;">${analise.noticias_midia || 'Nenhum apontamento mapeado.'}</div>
        </div>
    </div>

    <div class="parecer-wrapper" style="margin-top: 3rem;">
        <div class="parecer-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--blue);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Parecer Final de Crédito
        </div>
        <div class="parecer-body"><b>RECOMENDAÇÃO TÉCNICA: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}</b>\n\n${analise.parecer_analista || 'Sem parecer conclusivo preenchido.'}</div>
        <div class="parecer-footer">
            Responsável pela Análise: <span style="color:var(--blue-dark);">${analise.analista || '-'}</span>
        </div>
    </div>

    ${(analise.anexos?.fotos_visita_url || analise.site) ? `
    <div class="print-break divisor-anexos"></div>
    <h2>Anexos Técnicos</h2>
    ` : ''}

    ${analise.anexos?.fotos_visita_url ? `
    <h3 style="color: var(--muted); text-transform: uppercase; font-size: 0.85rem; margin-top: 1.5rem;">Registros Fotográficos</h3>
    <div class="grid-3">
        <div class="card" style="padding:0; overflow:hidden; border:1px solid #cbd5e1; display:flex; justify-content:center; align-items:center; background:#f8fafc;">
            <a href="${analise.anexos.fotos_visita_url}" target="_blank" class="btn-maps" style="margin:2rem;">Ver Evidências da Visita</a>
        </div>
    </div>
    ` : ''}

    ${analise.site && analise.site !== '-' ? `
    <h3 style="color: var(--muted); text-transform: uppercase; font-size: 0.85rem; margin-top: 1.5rem;">Site Institucional</h3>
    
    <div class="card" style="padding: 1.5rem; border:1px solid #cbd5e1; display:flex; flex-direction:column; align-items:center; background:#f8fafc; transition: 0.3s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="font-size: 0.9rem; color: var(--muted);">
                Domínio: <strong style="color: var(--blue-dark);">${analise.site}</strong>
            </div>
            <a href="${analise.site.startsWith('http') ? analise.site : 'http://'+analise.site}" target="_blank" class="btn-maps" style="padding: 8px 16px; font-size: 0.9rem; background: var(--blue);">🌐 Acessar Site Completo</a>
        </div>

        <a href="${analise.site.startsWith('http') ? analise.site : 'http://'+analise.site}" target="_blank" style="width: 100%; display: block; border-radius: 0.5rem; overflow: hidden; border: 1px solid var(--border);">
            <img src="https://image.thum.io/get/width/1200/crop/800/delay/3/${analise.site}" 
                 alt="Preview do Site" 
                 style="width: 100%; height: auto; display: block; transition: transform 0.3s ease;"
                 onmouseover="this.style.transform='scale(1.02)'" 
                 onmouseout="this.style.transform='scale(1)'">
        </a>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 1rem; text-align: center;">
            A visualização em iframe foi substituída para garantir a segurança. Clique na imagem para navegar pelo site real.
        </div>
    </div>
    ` : ''}

</div>

<script>
    const endivLabels = ${arrayEndivLabels};
    const endivData = ${arrayEndivData};
    
    const ctxFat = document.getElementById('fatChart').getContext('2d');
    new Chart(ctxFat, {
        type: 'bar',
        data: {
            labels: ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"],
            datasets: [
                { label: '2026', data: ${arrayFat2026}, backgroundColor: '#2563eb' },
                { label: '2025', data: ${arrayFat2025}, backgroundColor: '#60a5fa' },
                { label: '2024', data: ${arrayFat2024}, backgroundColor: '#cbd5e1' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { 
                y: { 
                    display: true,
                    ticks: { callback: function(value) { return 'R$ ' + (value / 1000).toLocaleString('pt-BR') + 'k'; } }
                } 
            }
        }
    });

    if(endivLabels.length > 0) {
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
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Geração do Organograma Dinâmico vis.js
    const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
    if (orgaJson && orgaJson.nodes && orgaJson.edges) {
        const container = document.getElementById('network-container');
        const nodes = new vis.DataSet(orgaJson.nodes.map(n => ({
            ...n, 
            shape: 'box',
            font: { color: '#ffffff', size: 14, face: 'Inter', bold: true },
            color: { background: n.id.includes(window.location.hostname) || n.id === 'root' ? '#dc2626' : '#2563eb', border: '#1e3a8a' },
            margin: { top: 10, bottom: 10, left: 15, right: 15 },
            borderWidth: 2,
            shadow: true
        })));
        const edges = new vis.DataSet(orgaJson.edges.map(e => ({
            ...e, 
            color: { color: '#94a3b8' }, 
            arrows: 'to',
            font: { size: 10, color: '#64748b', face: 'Inter', background: 'white' }
        })));
        new vis.Network(container, { nodes, edges }, {
            layout: { improvedLayout: true },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 150, springConstant: 0.08 },
                maxVelocity: 50, solver: 'forceAtlas2Based', timestep: 0.35, stabilization: { iterations: 150 }
            },
            interaction: { hover: true, tooltipDelay: 200 }
        });
    }
</script>

</body>
</html>
      `;

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
      onClick={gerarRelatorioHTML}
      disabled={gerando || !analise.id}
      className="bg-green-600 hover:bg-green-700 border border-green-800 text-white font-bold px-3 py-1.5 text-[11px] uppercase cursor-pointer shadow-sm transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      title={!analise.id ? "Selecione uma análise real para gerar o relatório" : ""}
    >
      {gerando ? "⏳ GERANDO..." : "📄 RELATÓRIO HTML PREMIUM"}
    </button>
  );
}