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
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      
      // ==========================================
      // 1. ENDEREÇO E MAPS
      // ==========================================
      const localizacaoReal = analise.localizacao?.trim() || "Brasil";
      const enderecoQuery = encodeURIComponent(localizacaoReal);

      // ==========================================
      // 2. PROCESSAMENTO DAS TABELAS
      // ==========================================
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
            qtdRestritivos += Number(r.qtd) || 0;
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

      // Faturamento Mensal (YTD Lógico)
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

      const med2024 = qtd2024 > 0 ? tot2024 / 12 : 0;
      const med2025 = qtd2025 > 0 ? tot2025 / 12 : 0;
      const med2026 = qtd2026 > 0 ? tot2026 / 12 : 0;

      const faturamentoReferencia = med2026 > 0 ? med2026 : (med2025 > 0 ? med2025 : med2024);
      const alavancagem = faturamentoReferencia > 0 ? (totalBancosDet / faturamentoReferencia).toFixed(2) : "0.00";

      // PREPARAR ARRAYS PROS GRÁFICOS (CHART.JS)
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
      // 3. HTML BASE INJETADO
      // ==========================================
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dossiê Executivo - ${analise.razao_social}</title>
          
          <!-- Bibliotecas Embutidas p/ HTML Local -->
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          
          <style>
              :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; }
              body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; font-size: 13px; }
              .container { max-width: 1200px; margin: 0 auto; }
              .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
              @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: center; } }
              .header h1 { margin: 0; font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;}
              .header .meta { font-size: 0.85rem; opacity: 0.9; margin-top: 0.5rem; }
              .header .badge-top { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 600; font-size: 0.85rem; backdrop-filter: blur(4px); text-transform: uppercase;}
              h2 { font-size: 1.15rem; font-weight: 700; color: var(--text); margin: 2rem 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; }
              h2::before { content: ""; display: inline-block; width: 4px; height: 1.15rem; background-color: var(--blue); border-radius: 2px; }
              .grid-2, .grid-3, .grid-4 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
              @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-4 { grid-template-columns: repeat(4, 1fr); } }
              .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1.25rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); }
              .metric { margin-bottom: 1rem; }
              .metric-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 0.25rem; }
              .metric-value { font-size: 1.25rem; font-weight: 700; color: var(--text); }
              .table-wrap { overflow-x: auto; width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
              table { width: 100%; border-collapse: collapse; text-align: left; }
              th, td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
              th { background: #f8fafc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
              tr:hover { background: #f1f5f9; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .delta-pos { color: var(--green); font-weight: 600; }
              .delta-neg { color: var(--red); font-weight: 600; }
              .row-total td { background: var(--bg); font-weight: 700; font-size: 0.85rem; border-top: 2px solid var(--border); }
              .chart-container { position: relative; height: 280px; width: 100%; }
              .parecer-wrapper { background: white; border-radius: 0.5rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; position: relative; margin-bottom: 2rem;}
              .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--blue); }
              .parecer-header { background: #f8fafc; padding: 1rem 1.5rem; font-weight: 800; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size:0.9rem;}
              .parecer-body { padding: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: #334155; white-space: pre-wrap; text-align: justify;}
              .parecer-footer { background: #f8fafc; padding: 0.75rem 1.5rem; border-top: 1px solid #e2e8f0; color: var(--muted); font-size: 11px; }
              .btn-maps { background: var(--blue); color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 700; display: inline-block; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.1); }
              @media print { .print-break { page-break-before: always; } }
          </style>
      </head>
      <body>

      <div class="container">
          <div class="header">
              <div>
                  <h1>${analise.razao_social}</h1>
                  <div class="meta">CNPJ: ${analise.cnpj} | Data Emissão: ${dataAtual} | Analista: ${analise.analista || '-'} | Gerente: ${analise.gerente || '-'}</div>
              </div>
              <div class="badge-top">SUGESTÃO: ${analise.recomendacao_analista || 'EM ANÁLISE'}</div>
          </div>

          <div class="grid-3" style="margin-bottom: 1.5rem;">
              <div class="card" style="grid-column: span 1; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px dashed var(--blue);">
                  <div class="metric-label" style="color:var(--blue-dark);">Rating Sugerido</div>
                  <div class="metric-value" style="color: var(--yellow); text-align:center;">${analise.rating || '-'}</div>
              </div>
              <div class="card" style="grid-column: span 2;">
                  <div class="metric-label" style="margin-bottom: 0.5rem;">Resumo Executivo (Visita Comercial)</div>
                  <div style="font-size: 0.85rem; color: var(--muted); line-height: 1.5; text-align: justify; white-space: pre-wrap;">${analise.resumo_visita || 'Sem resumo cadastrado.'}</div>
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
                          <td class="text-right" style="color:var(--blue-dark);">${formatarMoeda(totalLimites)}</td>
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
              <div class="card" style="margin-bottom:0; padding:1rem;">
                  <div class="metric-label">Localização & Ramo de Atividade</div>
                  <div style="font-weight: 600; font-size: 0.85rem;">${analise.localizacao || '-'}<br><span style="font-weight:normal; color:var(--muted);">${analise.ramo || '-'}</span></div>
                  <div style="font-size:11px; color:var(--muted); margin-top:10px;">Site: ${analise.site || 'Não Informado'} | Balanço Auditado: ${analise.balanco_auditado || 'Não'}</div>
              </div>
              <div class="card" style="margin-bottom:0; padding:1rem;">
                  <div class="metric-label">Quadro Societário & Assinaturas</div>
                  <table style="width:100%; font-size: 0.8rem; border-collapse: collapse;">
                      ${socioRows}
                  </table>
                  <div style="font-size:11px; color:var(--muted); margin-top:10px;">Regra de Assinatura: <strong>${analise.regra_assinatura || '-'}</strong> | Aval: <strong>${analise.aval_societario || '-'}</strong></div>
              </div>
          </div>

          <!-- LOCALIZAÇÃO / MAPS -->
          <div class="grid-2" style="margin-top: 1.5rem;">
              <div class="card" style="padding:0; overflow:hidden; position:relative;">
                  <div style="position:absolute; top:10px; left:10px; background:rgba(255,255,255,0.9); padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; z-index:10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">Visão de Satélite</div>
                  <iframe width="100%" height="300" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${enderecoQuery}&t=k&z=18&output=embed" allowfullscreen></iframe>
              </div>
              
              <div class="card" style="padding: 2rem; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#f8fafc; text-align: center;">
                  <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📍</div>
                  <div style="font-weight: 800; color: var(--blue-dark); margin-bottom: 0.5rem; font-size: 1.1rem;">Endereço Mapeado</div>
                  <div style="font-size: 0.85rem; color: var(--text); font-weight: 500; margin-bottom: 1.5rem; max-width: 90%; line-height: 1.5;">${localizacaoReal}</div>
                  
                  <div style="display: flex; gap: 0.75rem; width: 100%; justify-content: center; flex-wrap: wrap;">
                      <a href="https://www.google.com/maps/search/?api=1&query=${enderecoQuery}" target="_blank" class="btn-maps" style="background: var(--blue);">🗺️ Abrir Mapa Externo</a>
                      <a href="https://www.google.com/maps?q=${enderecoQuery}&layer=c" target="_blank" class="btn-maps" style="background: #16a34a;">🚶‍♂️ Street View interativo</a>
                  </div>
              </div>
          </div>

          <!-- ORGANOGRAMA INTERATIVO (VIS.JS) -->
          <h2 style="margin-top: 3rem;">3. Organograma / Teia Societária</h2>
          <div style="margin-bottom: 2rem;">
              ${analise.organograma_json && analise.organograma_json.nodes && analise.organograma_json.nodes.length > 0 ? `
              <div class="card" style="padding:1rem;">
                  <div id="network-container" style="width: 100%; height: 500px; border: 1px solid var(--border); border-radius: 0.5rem; background: #fafafa;"></div>
              </div>
              ` : analise.anexos?.organograma_url ? `
              <div class="card" style="padding: 1rem; display:flex; justify-content:center;">
                  <img src="${analise.anexos.organograma_url}" style="max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 0.5rem;">
              </div>
              ` : `
              <div class="card" style="display:flex; justify-content:center; align-items:center; height:150px; color:var(--muted); font-weight:600;">[NENHUM ORGANOGRAMA VINCULADO]</div>
              `}
          </div>

          ${totalPatrimonio > 0 ? `
          <h3 style="color: var(--muted); text-transform: uppercase; font-size: 0.85rem; margin-top: 1.5rem;">Patrimônio Garantidores (Bens IRPF)</h3>
          <div class="table-wrap">
              <table>
                  <tbody>
                      ${patrimonioRows}
                      <tr class="row-total">
                          <td>TOTAL PATRIMÔNIO AVALIADO</td>
                          <td class="text-right" style="color:var(--green);">${formatarMoeda(totalPatrimonio)}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
          ` : ''}

          <div class="print-break"></div>

          <h2>4. Faturamento Consolidado</h2>
          <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
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
                      <tr class="row-total" style="background:#f1f5f9;">
                          <td>MÉDIA MENSAL</td>
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
                  <div style="font-size:0.85rem; margin-bottom:0.5rem;">Ticket Médio Operado: <strong>${formatarMoeda(analise.dados_potencial?.ticket_medio)}</strong></div>
                  <div style="font-size:0.85rem; margin-bottom:0.5rem;">Prazo de Vendas (Duplicatas): <strong>${analise.dados_potencial?.prazo_medio_dpls || '-'}</strong></div>
                  <div style="font-size:0.85rem;">Divisão de Recebimento: <strong>${analise.dados_potencial?.forma_recebimento_prazo || 0}% a Prazo</strong></div>
              </div>
              <div class="card" style="margin-bottom:0; background:#f0fdf4; border-color:#86efac; display:flex; flex-direction:column; justify-content:center;">
                  <div class="metric-label" style="color:#166534;">Potencial Real Estimado (Ciclo)</div>
                  <div class="metric-value" style="color:#15803d; font-size:2rem;">${formatarMoeda(analise.dados_potencial?.potencial_estimado)}</div>
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
                          <tr><td>Volume Total Mapeado</td><td class="text-right font-bold" style="color:var(--red);">${formatarMoeda(totalBancosDet)}</td></tr>
                          <tr><td colspan="2" class="text-center" style="font-size:0.75rem; padding: 1.5rem; color:var(--muted);">
                              Indicador de Alavancagem:<br>
                              <strong style="color:var(--text); font-size: 1.1rem;">${alavancagem} x Fat. Médio</strong>
                          </td></tr>
                      </tbody>
                  </table>
              </div>
              
              <div class="card" style="grid-column: span 2; padding: 1rem; margin-bottom:0;">
                  <div class="metric-label" style="margin-bottom: 1rem;">Distribuição das Dívidas por Credor</div>
                  <div class="chart-container" style="height: 180px;"><canvas id="endivChart"></canvas></div>
              </div>
          </div>
          
          <div class="table-wrap" style="margin-top: 1.5rem;">
              <table>
                  <thead><tr><th>Credor / Instituição Financeira</th><th>Modalidade Contratada</th><th class="text-right">Saldo Devedor Atual</th></tr></thead>
                  <tbody>
                      ${bancoRows}
                      ${totalBancosDet > 0 ? `<tr class="row-total"><td colspan="2">TOTAL SCR SCRUTADO</td><td class="text-right" style="color:var(--red);">${formatarMoeda(totalBancosDet)}</td></tr>` : ''}
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
          ${totalRestritivos > 0 ? `
          <div class="table-wrap">
              <table>
                  <thead><tr><th>Envolvido (Empresa/Sócio)</th><th>Tipo de Ocorrência</th><th class="text-center">Qtd</th><th class="text-right">Montante</th></tr></thead>
                  <tbody>
                      ${restritivosRows}
                      <tr class="row-total"><td colspan="3">EXPOSIÇÃO FINANCEIRA RESTRITIVA</td><td class="text-right" style="color:var(--red);">${formatarMoeda(totalRestritivos)}</td></tr>
                  </tbody>
              </table>
          </div>
          ` : `<div class="card" style="text-align:center; color:var(--green); font-weight:bold; margin-bottom: 1.5rem;">Nenhum apontamento mapeado.</div>`}

          <div class="grid-2">
              <div class="card" style="padding:1.25rem;">
                  <div style="font-weight:800; font-size:0.8rem; color:var(--red); margin-bottom:0.5rem; text-transform:uppercase; border-bottom: 1px solid #fca5a5; padding-bottom: 5px;">⚠️ Litígios e Processos Ativos</div>
                  <div style="font-size:0.8rem; color:#334155; white-space: pre-wrap;">${analise.juridico_tramitacao || 'Nenhum apontamento judicial crítico localizado.'}</div>
              </div>
              <div class="card" style="padding:1.25rem;">
                  <div style="font-weight:800; font-size:0.8rem; color:var(--blue-dark); margin-bottom:0.5rem; text-transform:uppercase; border-bottom: 1px solid #bfdbfe; padding-bottom: 5px;">🔍 Análise de Mídia e Compliance</div>
                  <div style="font-size:0.8rem; color:#334155; white-space: pre-wrap;">${analise.noticias_midia || 'Nada consta em pesquisas de desabonadores digitais.'}</div>
              </div>
          </div>

          <div class="print-break"></div>

          <div class="parecer-wrapper" style="margin-top: 2rem;">
              <div class="parecer-header">Parecer Técnico / Deliberação da Mesa de Risco</div>
              <div class="parecer-body"><b>RECOMENDAÇÃO TÉCNICA: ${analise.recomendacao_analista?.toUpperCase() || 'EM ANÁLISE'}</b>\n\n${analise.parecer_analista || 'Sem parecer conclusivo preenchido.'}</div>
              <div class="parecer-footer">Emitido por: <strong>${analise.analista || 'Analista de Crédito'}</strong></div>
          </div>

      </div>

      <script>
          // SCRIPTS PARA RENDERIZAR OS GRAFICOS
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

          // SCRIPT DO ORGANOGRAMA INTERATIVO (VIS.JS)
          const orgaJson = ${JSON.stringify(analise.organograma_json || null)};
          if (orgaJson && orgaJson.nodes && orgaJson.edges) {
              const container = document.getElementById('network-container');
              if (container) {
                  const nodes = new vis.DataSet(orgaJson.nodes.map(n => ({
                      ...n, 
                      shape: 'box',
                      font: { color: '#ffffff', size: 14, face: 'Inter', bold: true },
                      color: { background: (n.id && (n.id.includes('.') || n.id === 'root')) ? '#dc2626' : '#2563eb', border: '#1e3a8a' },
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
      {gerando ? "⏳ GERANDO..." : "📊 RELATÓRIO HTML"}
    </button>
  );
}