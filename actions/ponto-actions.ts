"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// 🛡️ Função blindada: Recebe o token do navegador para provar quem é o usuário pro RLS
export async function registrarPonto(
  token: string, 
  usuarioId: string, 
  latitude: number | null, 
  longitude: number | null, 
  tipo: string
) {
  if (!usuarioId || !token) return { erro: "Acesso Negado: Sessão não encontrada." };

  try {
    const headersList = await headers();
    
    // Captura o IP real, furando os proxies da Vercel
    const ip = headersList.get("x-forwarded-for")?.split(',')[0] || headersList.get("x-real-ip") || "IP_DESCONHECIDO";
    const userAgent = headersList.get("user-agent") || "Navegador Desconhecido";

    // 🎯 O PULO DO GATO: Cria um client do Supabase que usa o Token do usuário logado!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabaseServer = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}` // Passa no RLS com sucesso!
        }
      }
    });

    const { error } = await supabaseServer.from("registro_ponto").insert({
      usuario_id: usuarioId,
      tipo: tipo,
      latitude,
      longitude,
      ip_origem: ip,
      user_agent: userAgent
      // A data_hora não vai aqui, o Supabase gera o now() lá dentro com a hora oficial
    });

    if (error) return { erro: `Falha no banco de dados: ${error.message}` };

    return { sucesso: true };
  } catch (err: any) {
    return { erro: `Erro interno no servidor: ${err.message}` };
  }
}