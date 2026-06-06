import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Verifica apenas autenticação — controle de assinatura fica no layout (Server Component)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
