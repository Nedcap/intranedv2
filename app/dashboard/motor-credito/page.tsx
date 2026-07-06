import BuscarEmpresa from "@/components/BuscarEmpresa";
import FilaAnalises from "@/components/FilaAnalises";

export default function MotorCreditoPage() {
  return (
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* CABEÇALHO */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Motor de Crédito V8</h1>
        <p className="text-sm text-gray-500">
          Consulte a base da Receita Federal, inicie novas análises e acompanhe a esteira de crédito.
        </p>
      </div>

      {/* BLOCO 1: BUSCA NA RECEITA + COMPONENTE DE UPLOAD (Gatilho de Entrada) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Nova Solicitação</h2>
        <BuscarEmpresa />
      </div>

      {/* BLOCO 2: A FILA DE ACOMPANHAMENTO DO COMERCIAL (O Radar) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Esteira de Análises em Andamento</h2>
        <FilaAnalises />
      </div>
    </div>
  );
}