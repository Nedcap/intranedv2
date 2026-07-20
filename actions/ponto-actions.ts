"use server";

import { headers, cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";

// Função blindada para gravar o ponto
export async function registrarPonto(latitude: number | null, longitude: number | null, tipo: string) {
  const supabase = createServerActionClient({ cookies });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Acesso Negado: Usuário não autenticado.");

  const headersList = headers();
  // Captura o IP real, evitando proxies que mascaram o IP
  const ip = headersList.get("x-forwarded-for")?.split(',')[0] || headersList.get("x-real-ip") || "IP_DESCONHECIDO";
  const userAgent = headersList.get("user-agent") || "Navegador Desconhecido";

  // Aqui você pode ativar a trava anti-esperto no futuro comparando o "ip" com o IP Fixo do seu escritório.
  
  const { error } = await supabase.from("registro_ponto").insert({
    usuario_id: user.id,
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

// Função para a tela saber em qual estado o botão deve estar
export async function buscarUltimoStatusPonto() {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "NENHUM";

  const dataAtual = new Date();
  dataAtual.setHours(0, 0, 0, 0); // Pega o começo do dia atual

  const { data, error } = await supabase
    .from("registro_ponto")
    .select("tipo")
    .eq("usuario_id", user.id)
    .gte("data_hora", dataAtual.toISOString()) // Só puxa registros de hoje
    .order("data_hora", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return "NENHUM";
  return data.tipo;
}