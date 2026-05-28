import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, Permission } from '@/generated/prisma/client'
import bcrypt from 'bcryptjs'

const VALID_PERMISSIONS = Object.values(Permission)

const TENANT_ADMIN_PERMS = ['DRIVE_CONFIGURAR', 'ANVISA_RELATORIOS', 'DSF_CANCELAR', 'SUPER_ADMIN_GLOBAIS']

function hasAdminAccess(perms: string[]) {
  return perms.some((p) => TENANT_ADMIN_PERMS.includes(p))
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!hasAdminAccess(perms)) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')
  const { searchParams } = new URL(request.url)
  const tenantIdFilter = isSuperAdmin ? (searchParams.get('tenantId') ?? '') : ''

  if (isSuperAdmin) {
    const where = tenantIdFilter ? { tenantId: tenantIdFilter } : {}
    const [users, tenants] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, tenantId: true, nome: true, email: true, permissions: true, crf: true, ativo: true, createdAt: true },
        orderBy: [{ tenant: { nomeFantasia: 'asc' } }, { nome: 'asc' }],
      }),
      prisma.tenant.findMany({
        select: { id: true, nomeFantasia: true },
        orderBy: { nomeFantasia: 'asc' },
      }),
    ])
    return Response.json({ users, tenants, isSuperAdmin: true })
  }

  // Tenant admin: só seu tenant
  const users = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, tenantId: true, nome: true, email: true, permissions: true, crf: true, ativo: true, createdAt: true },
    orderBy: { nome: 'asc' },
  })
  return Response.json({ users, tenants: [], isSuperAdmin: false })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!hasAdminAccess(perms)) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')

  let body: { tenantId?: string; nome: string; email: string; senha: string; permissions: string[]; crf?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { nome, email, senha, permissions: bodyPerms, crf } = body
  const tenantId = isSuperAdmin ? (body.tenantId ?? session.user.tenantId) : session.user.tenantId

  if (!nome?.trim() || !email?.trim() || !senha || !bodyPerms?.length) {
    return Response.json({ error: 'nome, email, senha e permissions são obrigatórios' }, { status: 400 })
  }

  const invalidPerm = bodyPerms.find((p) => !VALID_PERMISSIONS.includes(p as Permission))
  if (invalidPerm) return Response.json({ error: `Permissão inválida: ${invalidPerm}` }, { status: 400 })

  // Tenant admin não pode conceder SUPER_ADMIN_GLOBAIS
  if (!isSuperAdmin && bodyPerms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão para conceder Super Admin' }, { status: 403 })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: email.trim().toLowerCase() } },
    select: { id: true },
  })
  if (existing) return Response.json({ error: 'Já existe um usuário com este e-mail neste tenant' }, { status: 409 })

  const senhaHash = await bcrypt.hash(senha, 12)
  const user = await prisma.user.create({
    data: {
      tenantId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senhaHash,
      permissions: bodyPerms as Permission[],
      crf: crf?.trim() || null,
      ativo: true,
    },
    select: { id: true, tenantId: true, nome: true, email: true, permissions: true, crf: true, ativo: true, createdAt: true },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: { tenantId, userId: session.user.id, acao: AuditAcao.USUARIO_CRIADO, recursoTipo: 'User', recursoId: user.id, ip, userAgent: ua },
  })

  return Response.json({ user }, { status: 201 })
}
