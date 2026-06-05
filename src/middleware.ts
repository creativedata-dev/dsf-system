import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rotas que não precisam de verificação de assinatura
const PUBLIC_PATHS = [
  '/auth',
  '/api/auth',
  '/api/webhooks',
  '/api/cron',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/icon-',
]

const SUBSCRIPTION_BLOCKED_PATH = '/dashboard/assinatura-expirada'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Deixa passar rotas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Não bloqueia a própria página de expiração
  if (pathname === SUBSCRIPTION_BLOCKED_PATH) {
    return NextResponse.next()
  }

  // Só verifica rotas do dashboard
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.next() // NextAuth já cuida do redirect para login

  // Super Admin não é bloqueado por assinatura
  const permissions = (token.permissions as string[]) ?? []
  if (permissions.includes('SUPER_ADMIN_GLOBAIS')) return NextResponse.next()

  // Verifica status da assinatura via header interno (evita DB no middleware Edge)
  // A verificação real acontece no layout do dashboard — aqui apenas lemos o cookie de status
  const assinaturaStatus = request.cookies.get('assinatura_status')?.value

  if (assinaturaStatus === 'EXPIRADA' || assinaturaStatus === 'CANCELADA') {
    // APIs retornam 402 para que o frontend possa tratar
    if (pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'Assinatura expirada. Renove seu plano para continuar.' },
        { status: 402 },
      )
    }
    // Páginas redirecionam para a tela de aviso
    return NextResponse.redirect(new URL(SUBSCRIPTION_BLOCKED_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
