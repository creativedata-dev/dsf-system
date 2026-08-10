import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHash } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, DsfStatus } from '@/generated/prisma/client'
import { generateDsfPdf } from '@/lib/pdf-dsf'
import { uploadPdfToDrive } from '@/lib/drive'
import { sendDsfEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DSF_EMITIR')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: {
    dsfId: string
    assinaturaPacienteBase64?: string
    assinaturaRtBase64?: string
    enviarEmail?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { dsfId, assinaturaPacienteBase64, assinaturaRtBase64, enviarEmail } = body
  if (!dsfId) return Response.json({ error: 'dsfId é obrigatório' }, { status: 400 })

  const tenantId = session.user.tenantId

  const dsf = await prisma.dSF.findUnique({
    where: { id: dsfId },
    include: {
      cliente: true,
      responsavelTecnico: true,
      atendente: true,
      tenant: true,
      insumos: true,
    },
  })

  if (!dsf || dsf.tenantId !== tenantId) {
    return Response.json({ error: 'DSF não encontrada' }, { status: 404 })
  }
  if (dsf.status === DsfStatus.CANCELADA) {
    return Response.json({ error: 'DSF cancelada não pode ser assinada' }, { status: 409 })
  }

  const timestamp = new Date().toISOString()

  const pdfBytes = await generateDsfPdf(
    {
      numeroDsf: dsf.numeroDsf,
      dataEmissao: dsf.dataEmissao,
      drogariaNome: dsf.tenant.nomeFantasia,
      drogariaCnpj: dsf.tenant.cnpj ?? undefined,
      drogariaTelefone: dsf.tenant.telefone ?? undefined,
      rtNome: dsf.responsavelTecnico.nome,
      rtCrf: dsf.responsavelTecnico.crf ?? null,
      clienteNome: dsf.cliente.nome,
      clienteCpf: dsf.cliente.cpf,
      clienteDataNasc: dsf.cliente.dataNascimento,
      clienteTelefone: dsf.cliente.telefone,
      clienteEndereco: dsf.cliente.endereco,
      tipoServico: dsf.tipoServico,
      observacoes: dsf.observacoes ?? undefined,
      insumos: dsf.insumos.map(i => ({
        nomeProduto: i.nomeProduto,
        lote: i.lote,
        fabricante: i.fabricante,
        validade: i.validade,
      })),
    },
    {
      paciente: assinaturaPacienteBase64 ?? undefined,
      rt: assinaturaRtBase64 ?? undefined,
    },
    { hash: 'calculando...', timestamp }
  )

  // Calcula hash do PDF
  const hash = createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex')

  // Regera PDF com hash definitivo embutido
  const pdfFinal = await generateDsfPdf(
    {
      numeroDsf: dsf.numeroDsf,
      dataEmissao: dsf.dataEmissao,
      drogariaNome: dsf.tenant.nomeFantasia,
      drogariaCnpj: dsf.tenant.cnpj ?? undefined,
      drogariaTelefone: dsf.tenant.telefone ?? undefined,
      rtNome: dsf.responsavelTecnico.nome,
      rtCrf: dsf.responsavelTecnico.crf ?? null,
      clienteNome: dsf.cliente.nome,
      clienteCpf: dsf.cliente.cpf,
      clienteDataNasc: dsf.cliente.dataNascimento,
      clienteTelefone: dsf.cliente.telefone,
      clienteEndereco: dsf.cliente.endereco,
      tipoServico: dsf.tipoServico,
      observacoes: dsf.observacoes ?? undefined,
      insumos: dsf.insumos.map(i => ({
        nomeProduto: i.nomeProduto,
        lote: i.lote,
        fabricante: i.fabricante,
        validade: i.validade,
      })),
    },
    {
      paciente: assinaturaPacienteBase64 ?? undefined,
      rt: assinaturaRtBase64 ?? undefined,
    },
    { hash, timestamp }
  )

  // Upload para Drive
  let driveFileId: string | null = null
  let driveWarning: string | null = null
  try {
    driveFileId = await uploadPdfToDrive(tenantId, `${dsf.numeroDsf}-assinado.pdf`, pdfFinal)
    if (!driveFileId) driveWarning = 'Drive não configurado — DSF concluída sem upload.'
  } catch {
    driveWarning = 'Falha no upload para o Drive — DSF concluída sem upload.'
  }

  // Envio de email
  let emailEnviado = false
  let emailErro: string | null = null
  if (enviarEmail && dsf.cliente.email) {
    try {
      await sendDsfEmail(
        dsf.cliente.email,
        dsf.cliente.nome,
        dsf.numeroDsf,
        dsf.tenant.nomeFantasia,
        pdfFinal
      )
      emailEnviado = true
    } catch (e) {
      emailErro = e instanceof Error ? e.message : 'Erro ao enviar email'
    }
  }

  // Atualiza DSF
  await prisma.dSF.update({
    where: { id: dsfId },
    data: {
      status: DsfStatus.CONCLUIDA,
      hashDocumento: hash,
      assinadoEm: new Date(timestamp),
      ...(driveFileId ? { driveFileId } : {}),
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.DSF_CONCLUIDA,
      recursoTipo: 'DSF',
      recursoId: dsfId,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({
    ok: true,
    hash,
    timestamp,
    driveFileId,
    emailEnviado,
    warning: driveWarning ?? emailErro ?? null,
  })
}
