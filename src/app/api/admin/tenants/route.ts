import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, Permission, TipoImpressao } from '@/generated/prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      // Exclui tenants internos (aqueles que têm usuário Super Admin)
      NOT: { users: { some: { permissions: { has: Permission.SUPER_ADMIN_GLOBAIS } } } },
    },
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
      _count: { select: { users: true, dsfs: true } },
    },
    orderBy: { nomeFantasia: 'asc' },
  })

  return Response.json({ tenants })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: {
    nomeFantasia: string
    razaoSocial: string
    cnpj: string
    endereco: string
    telefone: string
    alvaraSanitario: string
    tipoImpressao?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { nomeFantasia, razaoSocial, cnpj, endereco, telefone, alvaraSanitario, tipoImpressao } = body

  if (!nomeFantasia?.trim() || !razaoSocial?.trim() || !cnpj?.trim() || !endereco?.trim() || !telefone?.trim() || !alvaraSanitario?.trim()) {
    return Response.json({ error: 'Todos os campos obrigatórios devem ser preenchidos' }, { status: 400 })
  }

  const cnpjClean = cnpj.replace(/\D/g, '')
  if (cnpjClean.length !== 14) {
    return Response.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  const existing = await prisma.tenant.findUnique({ where: { cnpj: cnpjClean }, select: { id: true } })
  if (existing) return Response.json({ error: 'Já existe um estabelecimento com este CNPJ' }, { status: 409 })

  const validTipo = tipoImpressao && Object.values(TipoImpressao).includes(tipoImpressao as TipoImpressao)
    ? tipoImpressao as TipoImpressao
    : TipoImpressao.BOBINA_80MM

  const tenant = await prisma.tenant.create({
    data: {
      nomeFantasia: nomeFantasia.trim(),
      razaoSocial: razaoSocial.trim(),
      cnpj: cnpjClean,
      endereco: endereco.trim(),
      telefone: telefone.trim(),
      alvaraSanitario: alvaraSanitario.trim(),
      tipoImpressao: validTipo,
      ativo: true,
    },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
      endereco: true,
      telefone: true,
      alvaraSanitario: true,
      tipoImpressao: true,
      ativo: true,
      createdAt: true,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: session.user.id,
      acao: AuditAcao.TENANT_CRIADO,
      recursoTipo: 'Tenant',
      recursoId: tenant.id,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({ tenant }, { status: 201 })
}
