"use client";

import { useState } from "react";

export default function GerarAnalise({ analise }: { analise: any }) {
  const [gerando, setGerando] = useState(false);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  };

  const gerarRelatorioHTML = () => {
    setGerando(true);

    try {
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      
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

      // ==========================================
      // FATURAMENTO MÉDIO (POR MESES PREENCHIDOS)
      // ==========================================
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

      const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dossiê Executivo - ${analise.razao_social}</title>
          
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
              
              /* =========================================
                 ANIMAÇÃO DOS CARDS JURÍDICOS (HOVER) 
                 ========================================= */
              .hover-card { transition: box-shadow 0.3s; }
              .hover-card:hover { box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
              .expandable-box { position: relative; max-height: 90px; overflow: hidden; transition: max-height 0.6s ease-in-out; }
              .expandable-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 50px; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1) 90%); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; font-size: 0.75rem; font-weight: 800; color: var(--blue); transition: opacity 0.3s; }
              .expandable-fade::after { content: "Passar o mouse para expandir ▼"; }
              
              .hover-card:hover .expandable-box { max-height: 2000px; }
              .hover-card:hover .expandable-fade { opacity: 0; pointer-events: none; }

              @media print { 
                  .print-break { page-break-before: always; } 
                  body { background: white; } 
                  .card, .table-wrap { box-shadow: none; border: 1px solid #cbd5e1; } 
                  .header { padding: 1rem; color: black; background: white; border: 2px solid black; } 
                  .header .meta, .header .badge-top { color: black; } 
                  .expandable-box { max-height: none !important; }
                  .expandable-fade { display: none !important; }
              }
          </style>
      </head>
      <body>

      <div class="container">
          <div class="header">
              <div>
                  <h1>${analise.razao_social}</h1>
                  <div class="meta">CNPJ: ${analise.cnpj || '-'} | Data Emissão: ${dataAtual} | Analista: ${analise.analista || '-'} | Gerente: ${analise.gerente || '-'}</div>
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

          <div class="print-break"></div>

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

          <div class="print-break"></div>

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

          <!-- CARDS JURÍDICOS EXPANSÍVEIS (HOVER) -->
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

          <div class="print-break"></div>

          <div class="parecer-wrapper" style="margin-top: 3rem;">
              <div class="parecer-header">Parecer Técnico / Deliberação da Mesa de Risco</div>
              <div class="parecer-body"><span style="color: var(--blue-dark); font-weight: 800; font-size: 1.1rem; display:block; margin-bottom: 1rem;">RECOMENDAÇÃO TÉCNICA: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}</span>${analise.parecer_analista || 'Sem parecer conclusivo preenchido.'}</div>
              <div class="parecer-footer">Documento Oficial Emitido por: <strong style="color: var(--blue-dark);">${analise.analista || 'Analista de Crédito'}</strong></div>
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

          // ==========================================
          // FIX ORGANOGRAMA: REMOVIDO WIDTH CONSTRAINT E AJUSTADO FÍSICA
          // ==========================================
          const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
          
          if (orgaJson && orgaJson.nodes && orgaJson.edges) {
              const container = document.getElementById('network-container');
              if (container) {
                  const nodes = new vis.DataSet(orgaJson.nodes.map(n => {
                      let rawLabel = (n.data && n.data.label) ? n.data.label : (n.label || n.id || "Sem Nome");
                      
                      // 1. Limpa possíveis lixos HTML que bugam o renderizador
                      rawLabel = String(rawLabel).replace(/<[^>]*>?/gm, ''); 

                      // 2. Quebra o texto matematicamente para forçar um formato quadrado
                      // (Isso faz com que o shape 'circle' englobe o texto uniformemente)
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
                      
                      // Insere um "enter" limpo, sem conflitos com strings escapadas no React
                      const finalLabel = lines.join(String.fromCharCode(10));

                      const bgColor = (n.style && n.style.backgroundColor) ? n.style.backgroundColor : '#2563eb';
                      const borderColor = (n.style && n.style.borderColor) ? n.style.borderColor : 'rgba(0,0,0,0.2)';

                      return {
                          id: n.id, 
                          label: finalLabel,
                          shape: 'circle',
                          margin: 15, // Cria o respiro interno do círculo
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
                          // Mudamos para repulsion para evitar o efeito "teia esgarçada" da imagem
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
      className="bg-blue-600 hover:bg-blue-700 border border-blue-800 text-white font-bold px-4 py-2 text-[11px] uppercase cursor-pointer shadow-md transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed rounded"
      title={!analise.id ? "Selecione uma análise real para gerar o relatório" : "Gerar Relatório Executivo HTML"}
    >
      {gerando ? "⏳ GERANDO..." : "📄 RELATÓRIO HTML PREMIUM"}
    </button>
  );
}