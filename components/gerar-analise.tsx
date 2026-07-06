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
      // 1. Processamento Dinâmico de Tabelas
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      const anoAtual = new Date().getFullYear();
      const anoFundacao = analise.dados_gerais.fundacao ? new Date(analise.dados_gerais.fundacao).getFullYear() : anoAtual;
      const idadeEmpresa = anoAtual - anoFundacao;

      // Societário
      const socioRows = analise.dados_estrutura_societaria.length > 0 
        ? analise.dados_estrutura_societaria.map((s: any) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 0;"><strong>${s.s_nome}</strong></td>
              <td style="padding: 4px 0; color: var(--muted);">${s.s_cargo}</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 600;">${s.s_perc}%</td>
          </tr>
        `).join("") 
        : `<tr><td colspan="3" style="color:var(--muted); text-align:center;">Nenhum sócio informado.</td></tr>`;

      // Patrimônio (pegando dos sócios)
      let totalPatrimonio = 0;
      const patrimonioRows = analise.dados_estrutura_societaria.filter((s:any) => s.b_bens && s.b_valor > 0).map((s: any) => {
        totalPatrimonio += Number(s.b_valor) || 0;
        return `
          <tr>
            <td style="font-weight:600;">${s.b_bens} <span style="font-size: 0.75rem; color: var(--muted); font-weight:normal;">(${s.s_nome})</span></td>
            <td class="text-right font-bold">${formatarMoeda(s.b_valor)}</td>
          </tr>
        `;
      }).join("");

      // Bancos e Endividamento
      let totalBancos = 0;
      let totalCurtoPrazo = 0;
      let totalLongoPrazo = 0;
      const bancoRows = analise.dados_endividamento.length > 0 
        ? analise.dados_endividamento.map((b: any) => {
            totalBancos += Number(b.saldo) || 0;
            // Simplificação para o exemplo: dividindo arbitrariamente se não houver campo específico
            totalCurtoPrazo += (Number(b.saldo) || 0) * 0.6; 
            totalLongoPrazo += (Number(b.saldo) || 0) * 0.4;
            return `
            <tr>
                <td style="font-weight:600; font-size:0.85rem;">${b.instituicao}</td>
                <td style="font-size:0.85rem;">${b.modalidade}</td>
                <td class="text-right font-bold" style="font-size:0.85rem;">${formatarMoeda(b.saldo)}</td>
            </tr>
            `;
        }).join("")
        : `<tr><td colspan="3" class="text-center" style="color:var(--muted);">Nenhum endividamento mapeado.</td></tr>`;

      // Restritivos
      let totalRestritivos = 0;
      const restritivosRows = analise.dados_restritivos.length > 0 
        ? analise.dados_restritivos.map((r: any) => {
            totalRestritivos += Number(r.valor) || 0;
            return `
            <tr>
                <td>${r.origem}</td>
                <td>${r.tipo}</td>
                <td class="text-center">${r.qtd}</td>
                <td class="text-right font-bold text-red-600">${formatarMoeda(r.valor)}</td>
            </tr>
            `;
        }).join("") 
        : `<tr class="row-total"><td colspan="2" style="color:var(--green);">TOTAL CONSOLIDADO (0 apontamentos)</td><td colspan="2" class="text-right" style="color:var(--green);">R$ 0,00</td></tr>`;

      // Referências
      const refRows = analise.dados_referencias.length > 0
        ? analise.dados_referencias.map((r: any) => `
          <tr>
            <td style="font-weight:600;">${r.fundo}</td>
            <td class="text-center">${r.cliente_desde}</td>
            <td class="text-center">Recente</td>
            <td class="text-right font-bold text-blue-600">${formatarMoeda(r.limite_global)}</td>
            <td class="text-right font-bold text-red-600">${formatarMoeda(r.risco_total)}</td>
            <td class="text-center">${r.obs || 'OK'}</td>
            <td class="text-right">${r.rnx || '-'}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="7" class="text-center" style="color:var(--muted);">Nenhuma referência bancária mapeada.</td></tr>`;

      // Faturamento Mensal
      const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      let tot2024 = 0, tot2025 = 0, tot2026 = 0;
      let qtd2024 = 0, qtd2025 = 0, qtd2026 = 0;

      const fatRows = meses.map(mes => {
        const val2024 = Number(analise.dados_faturamento["2024"]?.[mes]) || 0;
        const val2025 = Number(analise.dados_faturamento["2025"]?.[mes]) || 0;
        const val2026 = Number(analise.dados_faturamento["2026"]?.[mes]) || 0;
        
        tot2024 += val2024; if(val2024 > 0) qtd2024++;
        tot2025 += val2025; if(val2025 > 0) qtd2025++;
        tot2026 += val2026; if(val2026 > 0) qtd2026++;

        const delta1 = val2024 > 0 ? ((val2025 - val2024) / val2024) * 100 : 0;
        const delta2 = val2025 > 0 ? ((val2026 - val2025) / val2025) * 100 : 0;
        
        return `
        <tr>
            <td style="font-weight: 600; text-transform: capitalize;">${mes.substring(0, 3)}</td>
            <td class="text-center">${formatarMoeda(val2026)}</td>
            <td class="text-center ${delta2 > 0 ? 'delta-pos' : delta2 < 0 ? 'delta-neg' : ''}">${delta2 !== 0 ? delta2.toFixed(2) + '%' : '-'}</td>
            <td class="text-center">${formatarMoeda(val2025)}</td>
            <td class="text-center ${delta1 > 0 ? 'delta-pos' : delta1 < 0 ? 'delta-neg' : ''}">${delta1 !== 0 ? delta1.toFixed(2) + '%' : '-'}</td>
            <td class="text-center">${formatarMoeda(val2024)}</td>
        </tr>`;
      }).join("");

      // Médias e Potencial
      const med2024 = qtd2024 > 0 ? tot2024 / qtd2024 : 0;
      const med2025 = qtd2025 > 0 ? tot2025 / qtd2025 : 0;
      const med2026 = qtd2026 > 0 ? tot2026 / qtd2026 : 0;
      const potencialEstimado = med2025 * 2.5;
      const alavancagem = med2025 > 0 ? (totalBancos / med2025).toFixed(2) : "0.00";

      // 2. Arrays para o Chart.js
      const arrayFat2024 = JSON.stringify(meses.map(m => analise.dados_faturamento["2024"]?.[m] || 0));
      const arrayFat2025 = JSON.stringify(meses.map(m => analise.dados_faturamento["2025"]?.[m] || 0));
      const arrayFat2026 = JSON.stringify(meses.map(m => analise.dados_faturamento["2026"]?.[m] || 0));

      const arrayEndivLabels = JSON.stringify(analise.dados_endividamento.map((e:any) => e.modalidade));
      const arrayEndivData = JSON.stringify(analise.dados_endividamento.map((e:any) => e.saldo));

      // 3. O HTML MONSTRO COMPLETO (Template Literal)
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório Executivo - ${analise.razao_social}</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
              :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --blue: #2563eb; --blue-dark: #1e3a8a; --border: #e2e8f0; --green: #16a34a; --red: #dc2626; --yellow: #ca8a04; }
              body { font-family: 'Inter', sans-serif; background-color: var(--bg); color: var(--text); margin: 0; padding: 1.5rem; font-size: 14px; }
              .container { max-width: 1400px; margin: 0 auto; }
              .header { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); color: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
              @media(min-width: 768px){ .header { flex-direction: row; justify-content: space-between; align-items: center; } }
              .header h1 { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;}
              .header .meta { font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem; }
              .header .badge-top { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 600; font-size: 0.85rem; backdrop-filter: blur(4px); text-transform: uppercase;}
              h2 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 2.5rem 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; }
              h2::before { content: ""; display: inline-block; width: 4px; height: 1.25rem; background-color: var(--blue); border-radius: 2px; }
              .grid-2, .grid-3, .grid-4, .grid-6 { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
              @media (min-width: 768px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(3, 1fr); } .grid-6 { grid-template-columns: repeat(3, 1fr); } }
              @media (min-width: 1024px) { .grid-6 { grid-template-columns: repeat(6, 1fr); } }
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
              .parecer-wrapper { background: white; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; position: relative; margin-bottom: 3rem;}
              .parecer-wrapper::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--blue); }
              .parecer-header { background: #f8fafc; padding: 1rem 2rem; font-weight: 800; color: var(--blue-dark); border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;}
              .parecer-body { padding: 2rem; font-size: 1rem; line-height: 1.8; color: #334155; position: relative; white-space: pre-wrap; text-align: justify;}
              .parecer-footer { background: #f1f5f9; padding: 1rem 2rem; font-size: 0.85rem; font-weight: 600; color: var(--muted); border-top: 1px solid #e2e8f0; text-align: right; }
              @media print { .print-break { page-break-before: always; } }
          </style>
      </head>
      <body>

      <div class="container">
          <div class="header">
              <div>
                  <h1>${analise.razao_social}</h1>
                  <div class="meta">CNPJ(s): ${analise.cnpj} | Data Análise: ${dataAtual} | Analista: ${analise.dados_gerais.analista || '-'} | Gerente: ${analise.dados_gerais.gerente || '-'}</div>
              </div>
              <div class="badge-top">STATUS: ${analise.recomendacao_analista || 'EM ANÁLISE'}</div>
          </div>

          <h2>Proposta e Condições Comerciais</h2>
          <div class="table-wrap table-wrap-large">
              <table>
                  <thead><tr><th>Modalidade</th><th class="text-right">Limite</th><th class="text-center">Prazo Médio</th><th class="text-center">Tranche</th><th class="text-center">Taxa</th><th>Garantia</th></tr></thead>
                  <tbody>
                      <tr>
                          <td style="font-weight:600;">${analise.proposta.modalidade}</td>
                          <td class="text-right font-bold" style="color:var(--blue);">${formatarMoeda(analise.proposta.limite)}</td>
                          <td class="text-center">${analise.proposta.prazo} dias</td>
                          <td class="text-center">${formatarMoeda(analise.proposta.tranche)}</td>
                          <td class="text-center font-bold">${analise.proposta.taxa}%</td>
                          <td>${analise.proposta.garantia}</td>
                      </tr>
                      <tr class="row-total">
                          <td>LIMITE TOTAL</td>
                          <td class="text-right" style="color:var(--blue-dark);">${formatarMoeda(analise.proposta.limite)}</td>
                          <td colspan="4"></td>
                      </tr>
                  </tbody>
              </table>
          </div>

          <div class="grid-3" style="margin-bottom: 1.5rem;">
              <div class="card" style="grid-column: span 1; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; align-items:center; border: 2px dashed var(--blue);">
                  <div class="metric-label" style="color:var(--blue-dark);">Rating</div>
                  <div class="metric-value" style="color: var(--yellow); text-align:center;">RATING - ${analise.proposta.rating}</div>
              </div>
              <div class="card" style="grid-column: span 2;">
                  <div class="metric-label" style="margin-bottom: 0.5rem;">Resumo Executivo (Visita)</div>
                  <div style="font-size: 0.85rem; color: var(--muted); line-height: 1.5; text-align: justify; white-space: pre-wrap;">${analise.dados_qualitativos?.relatorio_visita || 'Sem resumo executivo preenchido.'}</div>
              </div>
          </div>

          <h2>Background da Empresa & Societário</h2>
          <div class="grid-2">
              <div class="table-wrap" style="margin-bottom:0;">
                  <table>
                      <thead><tr><th>Empresa</th><th>CNPJ</th><th>Fundação</th><th>Idade</th></tr></thead>
                      <tbody>
                          <tr>
                              <td style="font-weight:600; font-size:0.85rem;">${analise.razao_social}</td>
                              <td style="font-size:0.85rem;">${analise.cnpj}</td>
                              <td style="font-size:0.85rem;">${analise.dados_gerais.fundacao || '-'}</td>
                              <td style="font-size:0.85rem;">${idadeEmpresa} anos</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <div class="card" style="margin-bottom:0;">
                  <div class="metric">
                      <div class="metric-label">Localização & Ramo</div>
                      <div style="font-weight: 600; font-size: 0.9rem;">${analise.cidade} - ${analise.uf}<br><span style="font-weight:normal; font-size:0.8rem; color:var(--muted);">${analise.dados_gerais.ramo || 'Não informado'}</span></div>
                  </div>
                  <div class="metric">
                      <div class="metric-label">Quadro Societário</div>
                      <table style="width:100%; font-size: 0.85rem; border-collapse: collapse; margin-bottom: 0.5rem;">
                          ${socioRows}
                      </table>
                  </div>
              </div>
          </div>

          ${totalPatrimonio > 0 ? `
          <div class="table-wrap table-wrap-large" style="margin-top: 1.5rem;">
              <table>
                  <thead><tr><th>Patrimônio Informado (Bens)</th><th class="text-right">Valor</th></tr></thead>
                  <tbody>
                      ${patrimonioRows}
                      <tr class="row-total">
                          <td>TOTAL PATRIMÔNIO</td>
                          <td class="text-right" style="color:var(--green);">${formatarMoeda(totalPatrimonio)}</td>
                      </tr>
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
                          <td>TOTAL</td>
                          <td class="text-center">${formatarMoeda(tot2026)}</td>
                          <td class="text-center">--</td>
                          <td class="text-center">${formatarMoeda(tot2025)}</td>
                          <td class="text-center">--</td>
                          <td class="text-center">${formatarMoeda(tot2024)}</td>
                      </tr>
                      <tr class="row-total" >
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

          <h2>Potencial de Negócios</h2>
          <div class="grid-2">
              <div class="card" style="margin-bottom:0;">
                  <div class="metric-label">Ticket e Prazos</div>
                  <div style="font-size:0.9rem; margin-bottom:0.5rem;">Ticket Médio: <strong>${formatarMoeda(analise.dados_potencial.ticket_medio)}</strong></div>
                  <div style="font-size:0.9rem; margin-bottom:0.5rem;">Prazo Médio: <strong>${analise.dados_potencial.prazo_medio_vendas} dias</strong></div>
                  <div style="font-size:0.9rem;">Composição: <strong>${analise.dados_potencial.vendas_prazo_perc}% a prazo</strong></div>
              </div>
              <div class="card" style="margin-bottom:0; background:#f0fdf4; border-color:#86efac; display:flex; flex-direction:column; justify-content:center;">
                  <div class="metric-label" style="color:#166534;">Potencial Real Estimado</div>
                  <div class="metric-value" style="color:#15803d; font-size:2.5rem;">${formatarMoeda(potencialEstimado)}</div>
              </div>
          </div>

          <h2>Referências e Informações Bancárias</h2>
          <div class="table-wrap table-wrap-large">
              <table>
                  <thead><tr><th>Instituição / Fundo</th><th class="text-center">Cliente Desde</th><th class="text-center">Última Operação</th><th class="text-right">Limite Global</th><th class="text-right">Risco Total</th><th class="text-center">Comportamento</th><th class="text-right">RNX</th></tr></thead>
                  <tbody>
                      ${refRows}
                  </tbody>
              </table>
          </div>

          <h2>Passivo Bancário / Endividamento</h2>
          <div class="grid-3">
              <div class="table-wrap" style="grid-column: span 1; display:flex; flex-direction:column; margin-bottom:0;">
                  <table style="flex-grow: 1;">
                      <thead><tr><th colspan="2" class="text-center">Resumo Consolidado</th></tr></thead>
                      <tbody>
                          <tr><td>Curto Prazo</td><td class="text-right font-bold">${formatarMoeda(totalCurtoPrazo)}</td></tr>
                          <tr><td>Longo Prazo</td><td class="text-right font-bold">${formatarMoeda(totalLongoPrazo)}</td></tr>
                          <tr class="row-total"><td>TOTAL GERAL</td><td class="text-right" style="color:var(--red);">${formatarMoeda(totalBancos)}</td></tr>
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
                  <thead><tr><th>Credor / Instituição</th><th>Modalidade</th><th class="text-right">Saldo Devedor</th></tr></thead>
                  <tbody>
                      ${bancoRows}
                      <tr class="row-total"><td colspan="2">TOTAL ENDIVIDAMENTO DETALHADO</td><td class="text-right" style="color:var(--red); font-size:0.95rem;">${formatarMoeda(totalBancos)}</td></tr>
                  </tbody>
              </table>
          </div>

          <h2>Apontamentos Restritivos</h2>
          <div class="grid-6" style="margin-bottom: 1.5rem;">
              <div class="rest-card">
                  <div class="title">Total Apontamentos</div>
                  <div class="value">${formatarMoeda(totalRestritivos)}</div>
              </div>
          </div>

          <div class="table-wrap table-wrap-large" style="margin-bottom:0;">
              <table>
                  <thead><tr><th>Órgão / Origem</th><th>Restritivo</th><th class="text-center">Qtd</th><th class="text-right">Valor</th></tr></thead>
                  <tbody>
                      ${restritivosRows}
                  </tbody>
              </table>
          </div>

          <div class="print-break"></div>

          <h2>Levantamento Jurídico (Kappi)</h2>
          <div class="grid-2">
              <div class="card kappi-box" style="padding:1.5rem; cursor:auto; max-height:none;">
                  <div style="font-weight:800; font-size:0.9rem; color:var(--blue-dark); margin-bottom:0.75rem; text-transform:uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">🔴 Em Tramitação</div>
                  <div style="font-size:0.85rem; color:#334155; line-height:1.6; white-space: pre-wrap;">${analise.dados_qualitativos?.processos_tramitacao || 'Nenhum processo em tramitação relevante encontrado.'}</div>
              </div>
              <div class="card kappi-box" style="padding:1.5rem; cursor:auto; max-height:none;">
                  <div style="font-weight:800; font-size:0.9rem; color:var(--green); margin-bottom:0.75rem; text-transform:uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">🟢 Arquivados e Extintos</div>
                  <div style="font-size:0.85rem; color:#334155; line-height:1.6; white-space: pre-wrap;">${analise.dados_qualitativos?.processos_arquivados || 'Nenhum processo arquivado encontrado.'}</div>
              </div>
          </div>

          <div class="parecer-wrapper" style="margin-top: 4rem;">
              <div class="parecer-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--blue);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Parecer Final de Crédito
              </div>
              <div class="parecer-body"><b>RECOMENDAÇÃO: ${analise.recomendacao_analista?.toUpperCase()}</b>\n\n${analise.parecer_comite}</div>
              <div class="parecer-footer">
                  Responsável pela Análise: <span style="color:var(--blue-dark);">${analise.dados_gerais.analista || 'Analista'}</span>
              </div>
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
                  scales: { 
                      y: { 
                          display: true,
                          ticks: {
                              callback: function(value) { return 'R$ ' + (value / 1000).toLocaleString('pt-BR') + 'k'; }
                          }
                      } 
                  }
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
                  options: { 
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: 'right' } }
                  }
              });
          }
      </script>

      </body>
      </html>
      `;

      // 4. Cria um Blob com o HTML e abre numa nova aba para visualização e impressão
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");

    } catch (err) {
      alert("Erro ao gerar o relatório.");
      console.error(err);
    } finally {
      setGerando(false);
    }
  };

  return (
    <button
      onClick={gerarRelatorioHTML}
      disabled={gerando || !analise.id}
      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-md text-[10px] uppercase tracking-widest cursor-pointer shadow-sm transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      title={!analise.id ? "Selecione uma análise real para gerar o relatório" : ""}
    >
      {gerando ? "⏳ GERANDO..." : "📊 GERAR RELATÓRIO HTML"}
    </button>
  );
}