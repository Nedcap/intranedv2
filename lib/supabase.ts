import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 🎯 Fix: Validação preventiva para evitar telas brancas e erros silenciosos em produção
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ ERRO CRÍTICO: Variáveis de ambiente do Supabase não localizadas. " +
    "Verifique se NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY estão configuradas no seu .env ou na Vercel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);