"use server";

import { headers } from "next/headers";
import { supabase } from "@/lib/supabase";

// 🛡️ Função blindada para gravar o ponto (Data e IP são definidos pelo Servidor)
export async function registrarPonto(usuarioId: string, latitude: number | null, longitude: number | null, tipo: string) {
  if (!usuarioId) throw new Error("Acesso Negado: Usuário não identificado.");

  const headersList = headers();
  // Captura o IP real, furando proxies da Vercel
  const ip = headersList.get("x-forwarded-for")?.split(',')[0] || headersList.get("x-real-ip") || "IP_DESCONHECIDO";
  const userAgent = headersList.get("user-agent") || "Navegador Desconhecido";

  const { error } = await supabase.from("registro_ponto").insert({
    usuario_id: usuarioId,
    tipo: tipo,
    latitude,
    longitude,
    ip_origem: ip,
    user_agent: userAgent
    // A data/hora NÃO vai no insert. O Supabase cuida disso com "now()"
  });

  if (error) throw new Error(`Falha no banco de dados: ${error.message}`);

  return { sucesso: true };
}

// 🔍 Função para a tela saber em qual estado o botão deve estar hoje
export async function buscarUltimoStatusPonto(usuarioId: string) {
  if (!usuarioId) return "NENHUM";

  const dataAtual = new Date();
  dataAtual.setHours(0, 0, 0, 0); // Pega o começo do dia atual

  const { data, error } = await supabase
    .from("registro_ponto")
    .select("tipo")
    .eq("usuario_id", usuarioId)
    .gte("data_hora", dataAtual.toISOString()) // Só puxa registros de hoje
    .order("data_hora", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return "NENHUM";
  return data.tipo;
}