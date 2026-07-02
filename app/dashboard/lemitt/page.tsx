'use client';

import React, { useState } from 'react';

export default function LemitDashboardPage() {
  const [tipo, setTipo] = useState<'pessoa' | 'empresa'>('empresa');
  const [documento, setDocumento] = useState('');
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<{ doc: string; tipo: string; data: string }[]>([]);

  const executarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento) return;

    setCarregando(true);
    setErro(null);
    setDados(null);

    try {
      const response = await fetch('/api/lemmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, documento }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || 'Erro ao processar consulta.');
      }

      setDados(resultado);

      // Salva no histórico rápido da tela
      const novoItem = {
        doc: documento,
        tipo: tipo === 'empresa' ? 'CNPJ' : 'CPF',
        data: new Date().toLocaleTimeString('pt-BR'),
      };
      setHistorico((prev) => [novoItem, ...prev.slice(0, 4)]);

    } catch (err: any) {
      setErro(err.message || 'Falha na comunicação.');
    } finally {
      setCarregando(false);
    }
  };

  // Atalhos para ler os dados dinamicamente se for Pessoa ou Empresa [cite: 8, 44]
  const info = dados?.pessoa || dados?.empresa;
  const nomeExibicao = info?.nome || info?.razao_social;

  return (
    <div style={{ padding: '24px', maxWidth: '1250px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>Consulta Cadastral Lemit</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>Módulo de inteligência societária e análise de risco.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        
        {/* BLOCO DA ESQUERDA: CONSULTA E EXIBIÇÃO */}
        <div>
          <form onSubmit={executarConsulta} style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'pessoa' | 'empresa')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', fontWeight: 500 }}>
              <option value="empresa">CNPJ (Empresa)</option>
              <option value="pessoa">CPF (Pessoa)</option>
            </select>
            <input type="text" placeholder={tipo === 'empresa' ? 'Digite o CNPJ (apenas números)...' : 'Digite o CPF (apenas números)...'} value={documento} onChange={(e) => setDocumento(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
            <button type="submit" disabled={carregando} style={{ background: carregando ? '#93c5fd' : '#2563eb', color: '#fff', padding: '10px 24px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
              {carregando ? 'Buscando...' : 'Consultar'}
            </button>
          </form>

          {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', border: '1px solid #fca5a5' }}>{erro}</div>}

          {/* PAINEL DE RESULTADOS ESTRUTURADO */}
          {dados && info && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* CARTÃO PRINCIPAL */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
                <h2 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#0f172a', textTransform: 'uppercase' }}>{nomeExibicao}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '14px' }}>
                  <div><strong>Documento:</strong> <span style={{ fontFamily: 'monospace' }}>{info.cpf || info.cnpj}</span></div> [cite: 8, 44]
                  {info.situacao_cpf && <div><strong>Situação CPF:</strong> {info.situacao_cpf}</div>} [cite: 8]
                  {info.situacao && <div><strong>Situação Cadastral:</strong> {info.situacao}</div>} [cite: 44]
                  {info.renda && <div><strong>Estimativa de Renda:</strong> R$ {info.renda}</div>} [cite: 8]
                  {dados.risco_credito?.score_credito && <div><strong>Risco de Crédito:</strong> {dados.risco_credito.score_credito}</div>} [cite: 12]
                </div>
              </div>

              {/* CONTATOS: CELULARES E EMAILS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 10px 0', color: '#64748b' }}>Celulares Vinculados</h3> [cite: 10, 46]
                  {info.celulares?.length > 0 ? (
                    <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px' }}>
                      {info.celulares.map((c: any, i: number) => <li key={i} style={{ marginBottom: '4px' }}>({c.ddd}) {c.numero} {c.whatsapp && <span style={{ color: '#16a34a', fontSize: '12px' }}>(WhatsApp)</span>}</li>)} [cite: 10, 19]
                    </ul>
                  ) : <span style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum celular localizado.</span>}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 10px 0', color: '#64748b' }}>E-mails Vinculados</h3> [cite: 11, 46]
                  {info.emails?.length > 0 ? (
                    <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px' }}>
                      {info.emails.map((e: any, i: number) => <li key={i} style={{ marginBottom: '4px', fontFamily: 'monospace' }}>{e.email}</li>)} [cite: 11, 20]
                    </ul>
                  ) : <span style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum e-mail localizado.</span>}
                </div>
              </div>

              {/* ÁRVORE COMPLETA DO JSON EM CAIXA RETRÁTIL */}
              <details style={{ background: '#0f172a', color: '#f8fafc', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}>
                <summary style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>Ver JSON Técnico Completo</summary>
                <pre style={{ marginTop: '12px', fontSize: '13px', fontFamily: 'monospace', overflowX: 'auto', background: '#1e293b', padding: '12px', borderRadius: '6px', cursor: 'text', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(dados, null, 2)}
                </pre>
              </details>

            </div>
          )}
        </div>

        {/* BLOCO DA DIREITA: HISTÓRICO RÁPIDO */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>Consultas Recentes</h3>
            {historico.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Nenhuma busca nesta sessão.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historico.map((item, idx) => (
                  <div key={idx} onClick={() => { setDocumento(item.doc); setTipo(item.tipo === 'CNPJ' ? 'empresa' : 'pessoa'); }} style={{ fontSize: '13px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: item.tipo === 'CNPJ' ? '#2563eb' : '#b45309' }}>{item.tipo}</span>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{item.data}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', color: '#334155' }}>{item.doc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}