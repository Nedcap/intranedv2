"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastroPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; perfil: string } | null>(null);

  useEffect(() => {
    async function carregarCadastro() {
      try {
        setCarregando(true);
        
        const userStr = localStorage.getItem("intraned_user");
        let query = supabase.from("cadastro_cedentes").select("*");

        if (userStr) {
          const user = JSON.parse(userStr);
          const cargoUser = (user.perfil || user.cargo || "").toLowerCase();
          
          // Guarda a info do usuário na memória para o botão de "Nova Linha"
          setUsuarioAtual({ nome: user.nome, perfil: cargoUser });

          if (cargoUser === "comercial") {
            query = query.eq("comercial", user.nome);
          }
        }

        const { data } = await query.order("cedente", { ascending: true });
        if (data) setCedentes(data);
      } catch (err) { 
        console.error(err); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregarCadastro();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (index: number, campo: string, valor: any) => {
    const novos = [...cedentes]; 
    novos[index][campo] = valor; 
    setCedentes(novos);
  };

  // ➕ Função para adicionar uma nova linha em branco no topo da tabela
  const adicionarNovaLinha = () => {
    const novaLinha = {
      cedente: "", // O usuário vai digitar
      limite: "",
      taxa: "",
      docs_ok: null,
      obs: "",
      data_5: null,
      data_6: null,
      data_7: null,
      data_8: null,
      data_9: null,
      apto: null,
      // Se for comercial, já trava o nome dele. Se for Master, deixa em branco pro Master preencher
      comercial: usuarioAtual?.perfil === "comercial" ? usuarioAtual.nome : "",
      _isNovo: true // Flag interna para saber que é uma linha que acabou de nascer
    };
    
    setCedentes([novaLinha, ...cedentes]);
  };

  const salvarAlteracoes = async () => {
    try {
      setSalvando(true);
      
      // Validação básica antes de enviar pro banco
      const linhasInvalidas = cedentes.filter(c => c._isNovo && (!c.cedente || c.cedente.trim() === ""));
      if (linhasInvalidas.length > 0) {
        alert("⚠️ Preencha o nome do Cedente nas novas linhas antes de salvar!");
        setSalvando(false);
        return;
      }

      for (const item of cedentes) {
        const payload = {
          cedente: item.cedente.trim().toUpperCase(), 
          limite: item.limite || "", 
          taxa: item.taxa || "", 
          docs_ok: item.docs_ok, 
          obs: item.obs || "",
          data_5: item.data_5 || null, 
          data_6: item.data_6 || null, 
          data_7: item.data_7 || null, 
          data_8: item.data_8 || null, 
          data_9: item.data_9 || null,
          apto: item.apto, 
          comercial: item.comercial, 
          atualizado_em: new Date().toISOString()
        };

        await supabase.from("cadastro_cedentes").upsert(payload);
      }
      
      // Limpa a flag "_isNovo" das linhas locais para elas virarem registros normais
      setCedentes(cedentes.map(c => ({ ...c, _isNovo: false })));
      
      alert("🎉 Alterações salvas com sucesso!");
    } catch { 
      alert("❌ Erro ao salvar os dados no Supabase."); 
    } finally { 
      setSalvando(false); 
    }
  };

  if (carregando) return <div className="p-8 text-center animate-pulse text-slate-500 font-bold">Carregando carteira de clientes...</div>;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-6 text-[13px]">
      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">📇 Esteira de Cadastro</h2>
        <div className="flex gap-3">
          {/* Botão de Adicionar Linha Manual */}
          <button 
            onClick={adicionarNovaLinha} 
            disabled={salvando} 
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs cursor-pointer shadow-sm transition-all"
          >
            ➕ Adicionar Cedente
          </button>
          
          <button 
            onClick={salvarAlteracoes} 
            disabled={salvando} 
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs cursor-pointer shadow-sm transition-all"
          >
            {salvando ? "⏳ Salvando..." : "💾 Salvar Lote"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1400px] text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500 text-xs tracking-wider">
              <th className="p-3 w-56">Cedente</th>
              {usuarioAtual?.perfil !== "comercial" && (
                <th className="p-3 w-32 text-center text-blue-600">Comercial Resp.</th>
              )}
              <th className="p-3 text-center">Limite (BRL)</th>
              <th className="p-3 text-center">Taxa (%)</th>
              <th className="p-3 text-center">Docs Ok</th>
              <th className="p-3 w-56">Observações</th>
              <th className="p-3 text-center">Envio Sec</th>
              <th className="p-3 text-center">Assinatura Sec</th>
              <th className="p-3 text-center">Envio Fidc</th>
              <th className="p-3 text-center">Assinatura Fidc</th>
              <th className="p-3 text-center">Cadastro Adm</th>
              <th className="p-3 text-center">Apto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {cedentes.map((item, index) => (
              <tr key={item.cedente || `novo-${index}`} className={`hover:bg-slate-50/50 transition-colors ${item._isNovo ? "bg-blue-50/30" : ""}`}>
                
                {/* Nome do Cedente: Fixo se veio do banco, Editável se acabou de ser criado */}
                <td className="p-3 font-bold text-slate-900">
                  {item._isNovo ? (
                    <input 
                      type="text" 
                      placeholder="NOME DA EMPRESA" 
                      value={item.cedente} 
                      onChange={(e) => handleInputChange(index, "cedente", e.target.value.toUpperCase())} 
                      className="w-full p-1.5 border border-blue-300 rounded outline-none focus:border-blue-600 font-black text-xs uppercase shadow-xs bg-white" 
                      autoFocus
                    />
                  ) : (
                    item.cedente
                  )}
                </td>

                {/* Se quem tá editando for Master/BackOffice, ele pode digitar de qual comercial é esse cliente antigo */}
                {usuarioAtual?.perfil !== "comercial" && (
                  <td className="p-2 text-center">
                     <input 
                       type="text" 
                       value={item.comercial || ""} 
                       onChange={(e) => handleInputChange(index, "comercial", e.target.value)} 
                       className="w-28 p-1 border border-slate-200 rounded text-center text-[11px] outline-none focus:border-blue-500 font-bold text-blue-700 bg-transparent" 
                       placeholder="Nome do Comercial"
                     />
                  </td>
                )}

                <td className="p-2 text-center">
                  <input type="text" value={item.limite || ""} onChange={(e) => handleInputChange(index, "limite", e.target.value)} className="w-24 p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold" />
                </td>
                <td className="p-2 text-center">
                  <input type="text" value={item.taxa || ""} onChange={(e) => handleInputChange(index, "taxa", e.target.value)} className="w-12 p-1 border border-slate-200 rounded text-center text-xs outline-none focus:border-blue-500 font-bold" />
                </td>
                <td className="p-2 text-center">
                  <div className="flex gap-2 justify-center text-xs font-bold">
                    <label className="text-emerald-600 cursor-pointer flex items-center gap-1">
                      <input type="radio" checked={item.docs_ok === true} onChange={() => handleInputChange(index, "docs_ok", true)} /> ✔
                    </label>
                    <label className="text-red-500 cursor-pointer flex items-center gap-1">
                      <input type="radio" checked={item.docs_ok === false} onChange={() => handleInputChange(index, "docs_ok", false)} /> ✖
                    </label>
                  </div>
                </td>
                <td className="p-2">
                  <textarea value={item.obs || ""} onChange={(e) => handleInputChange(index, "obs", e.target.value)} className="w-full p-1 border border-slate-200 rounded text-xs h-8 resize-none outline-none focus:border-blue-500" />
                </td>
                {[5, 6, 7, 8, 9].map((num) => (
                  <td key={num} className="p-2 text-center">
                    <input type="date" value={item[`data_${num}`] || ""} onChange={(e) => handleInputChange(index, `data_${num}`, e.target.value)} className="p-1 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-500 font-bold text-slate-500" />
                  </td>
                ))}
                <td className="p-2 text-center">
                  <div className="flex gap-2 justify-center text-xs font-bold">
                    <label className="text-emerald-600 cursor-pointer flex items-center gap-1">
                      <input type="radio" checked={item.apto === true} onChange={() => handleInputChange(index, "apto", true)} /> ✔
                    </label>
                    <label className="text-red-500 cursor-pointer flex items-center gap-1">
                      <input type="radio" checked={item.apto === false} onChange={() => handleInputChange(index, "apto", false)} /> ✖
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}