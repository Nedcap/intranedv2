import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🛡️ SINCRONIZADOR DE SESSÃO COM COOKIES
// Toda vez que o estado de auth mudar no front (login/logout), injetamos um cookie acessível pelo Middleware
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      const maxAge = session.expires_in || 3600;
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } else {
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  });
}