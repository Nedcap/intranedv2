import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // 1. DEFINIÇÃO DE ZONAS DE SEGURANÇA
  const isDashboardRoute = path.startsWith('/dashboard');
  const isApiRoute = path.startsWith('/api');

  // Rotas de API que são públicas e NÃO precisam de bloqueio de token (ex: Webhooks, Recuperação de Senha)
  const publicApiRoutes = ['/api/recuperar', '/api/auth'];
  const isPublicApi = publicApiRoutes.some(route => path.startsWith(route));

  // 2. A CHECAGEM DO CRACHÁ
  // O Supabase sempre salva a sessão em um cookie que termina com '-auth-token'.
  // Vamos varrer os cookies da requisição em busca dele.
  const hasAuthCookie = req.cookies.getAll().some(cookie => cookie.name.endsWith('-auth-token'));

  // 3. AS REGRAS DO PORTEIRO

  // Regra A: Tentou acessar o painel (Dashboard) sem estar logado?
  if (isDashboardRoute && !hasAuthCookie) {
    // Redireciona imediatamente para a tela de login
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Regra B: Tentou forçar um disparo para uma API privada sem token?
  if (isApiRoute && !isPublicApi && !hasAuthCookie) {
    // Retorna Erro 401 (Unauthorized) direto na cara
    return NextResponse.json(
      { error: 'Acesso Negado. Credenciais de autenticação ausentes.' }, 
      { status: 401 }
    );
  }

  // Regra C: O cara JÁ ESTÁ logado, mas tentou abrir a tela de login ('/') ou de reset?
  if ((path === '/' || path === '/esqueci-senha') && hasAuthCookie) {
    // Joga ele direto pro painel, não precisa fazer login de novo
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Se passou por tudo isso, o acesso é legítimo. Pode seguir o fluxo!
  return res;
}

// 4. OTIMIZAÇÃO DE PERFORMANCE (Matcher)
// Dizemos ao Next.js para NÃO rodar o middleware em arquivos pesados e públicos
export const config = {
  matcher: [
    /*
     * Roda o middleware em todas as rotas, EXCETO:
     * - _next/static (arquivos JS/CSS estáticos gerados pelo build)
     * - _next/image (otimização nativa de imagens)
     * - favicon.ico (ícone do site)
     * - Arquivos puramente públicos (svg, png, jpg, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};