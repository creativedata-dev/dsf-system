import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, TipoImpressao } from '@/generated/prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params

  let body: {
    nomeFantasia?: string
    razaoSocial?: string
    cnpj?: string
    endereco?: string
    telefone?: string
    alvaraSanitario?: string
    tipoImpressao?: string
    logoUrl?: string | null
    ativo?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const target = await prisma.tenant.findUnique({ where: { id }, select: { id: true } })
  if (!target) return Response.json({ error: 'Estabelecimento não encontrado' }, { status: 404 })

  if (body.cnpj !== undefined) {
    const cnpjClean = body.cnpj.replace(/\D/g, '')
    if (cnpjClean.length !== 14) return Response.json({ error: 'CNPJ inválido' }, { status: 400 })
    const conflict = await prisma.tenant.findUnique({ where: { cnpj: cnpjClean }, select: { id: true } })
    if (conflict && conflict.id !== id) return Response.json({ error: 'CNPJ já cadastrado em outro estabelecimento' }, { status: 409 })
    body.cnpj = cnpjClean
  }

  const data: Record<string, unknown> = {}
  if (body.nomeFantasia !== undefined) data.nomeFantasia = body.nomeFantasia.trim()
  if (body.razaoSocial !== undefined) data.razaoSocial = body.razaoSocial.trim()
  if (body.cnpj !== undefined) data.cnpj = body.cnpj
  if (body.endereco !== undefined) data.endereco = body.endereco.trim()
  if (body.telefone !== undefined) data.telefone = body.telefone.trim()
  if (body.alvaraSanitario !== undefined) data.alvaraSanitario = body.alvaraSanitario.trim()
  if (body.tipoImpressao !== undefined && Object.values(TipoImpressao).includes(body.tipoImpressao as TipoImpressao)) {
    data.tipoImpressao = body.tipoImpressao
  }
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl ?? null
  if (body.ativo !== undefined) data.ativo = body.ativo

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
      endereco: true,
      telefone: true,
      alvaraSanitario: true,
      tipoImpressao: true,
      logoUrl: true,
      ativo: true,
      createdAt: true,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: session.user.id,
      acao: AuditAcao.TENANT_ATUALIZADO,
      recursoTipo: 'Tenant',
      recursoId: id,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({ tenant })
}
