import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendDsfEmail(
  to: string,
  clienteNome: string,
  numeroDsf: string,
  farmaNome: string,
  pdfBytes: Uint8Array
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP não configurado: defina SMTP_USER e SMTP_PASS nas variáveis de ambiente')
  }

  const transporter = createTransporter()

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"FarmaSign" <${process.env.SMTP_USER}>`,
    to,
    subject: `Seu Documento de Serviço Farmacêutico – ${numeroDsf}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Documento de Serviço Farmacêutico</h2>
        <p>Olá, <strong>${clienteNome}</strong>!</p>
        <p>Segue em anexo o seu Documento de Serviço Farmacêutico <strong>${numeroDsf}</strong>,
        emitido por <strong>${farmaNome}</strong>.</p>
        <p>Este documento é válido como comprovante do serviço farmacêutico prestado, conforme
        a RDC ANVISA nº 44/2009.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
          Este email foi enviado automaticamente pelo sistema FarmaSign. Não responda a este email.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `${numeroDsf}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: 'application/pdf',
      },
    ],
  })
}
