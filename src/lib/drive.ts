import { Readable } from 'stream'
import { google } from 'googleapis'
import { prisma } from './prisma'
import { decrypt, encrypt } from './crypto'

export async function uploadPdfToDrive(
  tenantId: string,
  fileName: string,
  pdfBytes: Uint8Array,
): Promise<string | null> {
  const cred = await prisma.driveCredential.findUnique({ where: { tenantId } })
  if (!cred) return null  // Drive não configurado para este tenant

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )

  oauth2.setCredentials({
    access_token: decrypt(cred.accessToken),
    refresh_token: decrypt(cred.refreshToken),
  })

  // Renovar access token se expirado
  if (new Date() >= cred.tokenExpiry) {
    try {
      const { credentials } = await oauth2.refreshAccessToken()
      oauth2.setCredentials(credentials)
      await prisma.driveCredential.update({
        where: { tenantId },
        data: {
          accessToken: encrypt(credentials.access_token!),
          tokenExpiry: new Date(credentials.expiry_date!),
        },
      })
    } catch {
      return null  // Token inválido — Drive desconectado
    }
  }

  const drive = google.drive({ version: 'v3', auth: oauth2 })

  const stream = new Readable()
  stream.push(Buffer.from(pdfBytes))
  stream.push(null)

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [cred.driveFolderId],
    },
    media: { mimeType: 'application/pdf', body: stream },
    fields: 'id',
  })

  return response.data.id ?? null
}
