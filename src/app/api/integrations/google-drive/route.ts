import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.redirect(new URL('/auth/login', request.url))

  const perms = session.user.permissions as string[]
  if (!perms.includes('DRIVE_CONFIGURAR')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/google-drive/callback`,
  )

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',       // garante refresh_token mesmo que já autorizado antes
    scope: ['https://www.googleapis.com/auth/drive.file'],
  })

  return NextResponse.redirect(authUrl)
}
