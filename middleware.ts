import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // 1. DEFINIÇÃO DE ZONAS DE SEGURANÇA
  const isDashboardRoute = path.startsWith('/dashboard');
  const isApiRoute = path.startsWith('/api');

  // Rotas de API que são públicas e NÃO precisam de bloqueio de token
  const publicApiRoutes = ['/api/recuperar', '/api/auth'];
  const isPublicApi = publicApiRoutes.some(route => path.startsWith(route));

  // 2. A CHECAGEM DO CRACHÁ (Abrangedora para capturar chunks .0, .1 e cookies customizados)
  const hasAuthCookie = req.cookies.getAll().some(cookie => {
    const name = cookie.name.toLowerCase();
    return (
      name.includes('auth-token') || 
      name.includes('sb-') || 
      name.includes('supabase') ||
      name === 'sb-access-token'
    );
  });

  // 3. AS REGRAS DO PORTEIRO

  // Regra A: Tentou acessar o painel (Dashboard) sem estar logado?
  if (isDashboardRoute && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Regra B: Tentou forçar um disparo para uma API privada sem token?
  if (isApiRoute && !isPublicApi && !hasAuthCookie) {
    return NextResponse.json(
      { error: 'Acesso Negado. Credenciais de autenticação ausentes.' }, 
      { status: 401 }
    );
  }

  // Regra C: O usuário JÁ ESTÁ logado, mas tentou abrir a tela de login ('/')
  if ((path === '/' || path === '/esqueci-senha') && hasAuthCookie) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};