import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { AuditAcao } from '@/generated/prisma/client'

function configUrl(path: string) {
  return `${process.env.NEXTAUTH_URL}/dashboard/configuracoes${path}`
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/login`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(configUrl('?drive=cancelado'))
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/google-drive/callback`,
  )

  try {
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      // Acontece se o usuário já autorizou anteriormente sem prompt:consent.
      // Instrução: revogar acesso em myaccount.google.com e tentar de novo.
      return NextResponse.redirect(configUrl('?drive=sem_refresh_token'))
    }

    oauth2.setCredentials(tokens)

    const tenantId = session.user.tenantId
    const [tenant, tokenInfo] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { nomeFantasia: true },
      }),
      oauth2.getTokenInfo(tokens.access_token),
    ])

    const driveEmail = tokenInfo.email ?? null

    // Cria pasta exclusiva para este tenant no Drive
    const drive = google.drive({ version: 'v3', auth: oauth2 })
    const folder = await drive.files.create({
      requestBody: {
        name: `FarmaSign — ${tenant?.nomeFantasia ?? tenantId}`,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    })

    const driveFolderId = folder.data.id!
    const tokenExpiry = new Date(tokens.expiry_date ?? Date.now() + 3_600_000)

    const credData = {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiry,
      driveFolderId,
      driveEmail,
    }
    const existing = await prisma.driveCredential.findUnique({ where: { tenantId } })
    if (existing) {
      await prisma.driveCredential.update({ where: { tenantId }, data: credData })
    } else {
      await prisma.driveCredential.create({ data: { tenantId, ...credData } })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const ua = request.headers.get('user-agent') ?? 'unknown'

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        acao: AuditAcao.DRIVE_AUTORIZADO,
        recursoTipo: 'DriveCredential',
        recursoId: driveFolderId,
        ip,
        userAgent: ua,
      },
    })

    return NextResponse.redirect(configUrl('?drive=conectado'))
  } catch (err) {
    console.error('[drive/callback]', err)
    return NextResponse.redirect(configUrl('?drive=erro'))
  }
}
