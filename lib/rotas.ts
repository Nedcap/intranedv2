/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

// ============================================================================
// 🎨 BIBLIOTECA DE ÍCONES PREMIUM (SVGs Nativos)
// Podem receber classes do Tailwind dinamicamente (ex: className="w-5 h-5")
// ============================================================================
const IcoHome = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>;
const IcoMail = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
const IcoRocket = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.438 4.438 0 002.736-2.736m8.22-4.13a4.49 4.49 0 004.306-1.757 4.438 4.438 0 00-2.736 2.736" /></svg>;
const IcoTarget = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" /></svg>;
const IcoBrain = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 10-7.516 0c.85.496 1.508 1.333 1.508 2.316V18" /></svg>;
const IcoCompass = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>;
const IcoSearch = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const IcoNetwork = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
const IcoClipboard = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>;
const IcoFlag = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.15.74a9 9 0 01-5.96-.154l-.146-.056a9 9 0 00-6.42-.511L3 9m0 6V9" /></svg>;
const IcoChartLine = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>;
const IcoBriefcase = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.084-.905 1.96-2.029 2.022a22.21 22.21 0 01-12.442 0c-1.124-.062-2.029-.938-2.029-2.022V14.15M8.25 9.75H15.75m-7.5 0a2.25 2.25 0 01-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25h7.5a2.25 2.25 0 012.25 2.25v1.5a2.25 2.25 0 01-2.25 2.25m-7.5 0h7.5" /></svg>;
const IcoAlert = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" /></svg>;
const IcoArchive = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>;
const IcoUsers = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IcoChartPie = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>;
const IcoMoney = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>;
const IcoCalculator = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V21m-7.5-5.25V21m3.75-5.25V21m3.75-10.5V6m-7.5 4.5V6m3.75 4.5V6M3 12h18M3 12a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 12m-18 0a2.25 2.25 0 00-2.25 2.25h13.5A2.25 2.25 0 0021 12" /></svg>;
const IcoCheckBadge = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const IcoArrowDown = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const IcoDocument = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const IcoDocumentSearch = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
const IcoCog = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IcoHierarchy = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
const IcoEnvelope = (p: any) => <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" /></svg>;


// ============================================================================
// 🧠 TIPAGEM ATUALIZADA
// ============================================================================
export interface RotaSistema {
  nome: string;
  path: string;
  // Agora o ícone é um Componente React! 
  // Podendo receber className="..." direto na renderização.
  icone: React.FC<React.SVGProps<SVGSVGElement>>; 
  categoria: "Geral" | "Comercial" | "Crédito" | "Consultas" | "Financeiro" | "Cadastro" | "Configurações";
  defaultMaster: boolean;
}

// ============================================================================
// 🗺️ MAPA DE ROTAS (FUNCIONALIDADE 100% MANTIDA)
// ============================================================================
export const MAPA_DE_ROTAS: RotaSistema[] = [
  // 🏠 GERAL
  { nome: "Início (Home)", path: "/dashboard", icone: IcoHome, categoria: "Geral", defaultMaster: true },
  { nome: "TriageMail (E-mails)", path: "/dashboard/monitor-email", icone: IcoMail, categoria: "Geral", defaultMaster: true },

  // 🎯 COMERCIAL
  { nome: "NedHub Comercial", path: "/dashboard/nedhub", icone: IcoRocket, categoria: "Comercial", defaultMaster: true },
  { nome: "Controle Comercial", path: "/dashboard/comercial", icone: IcoTarget, categoria: "Comercial", defaultMaster: true },
  { nome: "Prospect.A.I", path: "/dashboard/prospeccao", icone: IcoBrain, categoria: "Comercial", defaultMaster: true },
  { nome: "Naveg.A.I", path: "/dashboard/planejador", icone: IcoCompass, categoria: "Comercial", defaultMaster: true },

  // 🛡️ CRÉDITO E RISCO
  { nome: "Solicitar Análise", path: "/dashboard/motor-credito/envio-analise", icone: IcoRocket, categoria: "Crédito", defaultMaster: true },
  { nome: "Mesa de Crédito V8", path: "/dashboard/motor-credito/analise", icone: IcoSearch, categoria: "Crédito", defaultMaster: true },
  { nome: "Busca Grupo", path: "/dashboard/busca-grupo", icone: IcoNetwork, categoria: "Crédito", defaultMaster: true },
  { nome: "Análises Em Comitê", path: "/dashboard/comite", icone: IcoClipboard, categoria: "Crédito", defaultMaster: true },
  { nome: "Finalizados", path: "/dashboard/finalizados", icone: IcoFlag, categoria: "Crédito", defaultMaster: true },
  { nome: "Carteira Dinâmica", path: "/dashboard/carteira", icone: IcoChartLine, categoria: "Crédito", defaultMaster: true },
  { nome: "Estoque Cedentes", path: "/dashboard/estoque-cedentes", icone: IcoBriefcase, categoria: "Crédito", defaultMaster: true },

  // 🔎 CONSULTAS
  { nome: "Lemitt", path: "/dashboard/lemitt", icone: IcoSearch, categoria: "Consultas", defaultMaster: true },
  { nome: "Monitore Diário", path: "/dashboard/monitore-diario", icone: IcoAlert, categoria: "Consultas", defaultMaster: true },
  { nome: "Monitore Histórico", path: "/dashboard/monitore-historico", icone: IcoArchive, categoria: "Consultas", defaultMaster: true },
  { nome: "Restritivos Sócios", path: "/dashboard/restritivos-socios", icone: IcoUsers, categoria: "Consultas", defaultMaster: true },

  // 💰 FINANCEIRO
  { nome: "Painel de Indicadores (BI)", path: "/dashboard/powerbi", icone: IcoChartPie, categoria: "Financeiro", defaultMaster: true },
  { nome: "Controle Financeiro", path: "/dashboard/financeiro", icone: IcoMoney, categoria: "Financeiro", defaultMaster: true },
  { nome: "Cálculo de Comissões", path: "/dashboard/calculo-comissoes", icone: IcoMoney, categoria: "Financeiro", defaultMaster: true },
  { nome: "Controle de Checagem", path: "/dashboard/checagem", icone: IcoCheckBadge, categoria: "Financeiro", defaultMaster: true },
  { nome: "Simulador de Rentabilidade", path: "/dashboard/simulador", icone: IcoCalculator, categoria: "Financeiro", defaultMaster: true },
  { nome: "Importação de Dados", path: "/dashboard/importacao", icone: IcoArrowDown, categoria: "Financeiro", defaultMaster: true },

  // 📝 CADASTRO
  { nome: "Cadastro Cedentes", path: "/dashboard/cadastro", icone: IcoDocument, categoria: "Cadastro", defaultMaster: true },
  { nome: "Revisão Cedentes", path: "/dashboard/revisao", icone: IcoDocumentSearch, categoria: "Cadastro", defaultMaster: true },

  // ⚙️ CONFIGURAÇÕES
  { nome: "Gerenciar Usuários", path: "/dashboard/gerenciar-usuarios", icone: IcoCog, categoria: "Configurações", defaultMaster: true },
  { nome: "Hierarquias e Acessos", path: "/dashboard/configuracoes/hierarquia", icone: IcoHierarchy, categoria: "Configurações", defaultMaster: true },
  { nome: "Templates de E-mail", path: "/dashboard/configuracoes/templates", icone: IcoEnvelope, categoria: "Configurações", defaultMaster: true }
];

export const obterRotasMaster = () => 
  MAPA_DE_ROTAS.filter(r => r.defaultMaster === true).map(r => r.path);