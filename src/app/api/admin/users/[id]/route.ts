import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, Permission } from '@/generated/prisma/client'
import bcrypt from 'bcryptjs'

const VALID_PERMISSIONS = Object.values(Permission)
const TENANT_ADMIN_PERMS = ['DRIVE_CONFIGURAR', 'ANVISA_RELATORIOS', 'DSF_CANCELAR', 'SUPER_ADMIN_GLOBAIS']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  const hasAccess = perms.some((p) => TENANT_ADMIN_PERMS.includes(p))
  if (!hasAccess) return Response.json({ error: 'Sem permissão' }, { status: 403 })

  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')
  const { id } = await params

  let body: { nome?: string; email?: string; senha?: string; permissions?: string[]; crf?: string | null; ativo?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  })

  // Tenant admin só pode editar usuários do próprio tenant
  const allowedTenantId = session.user.tenantId
  if (!target || (!isSuperAdmin && target.tenantId !== allowedTenantId)) {
    return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  if (id === session.user.id) {
    if (body.ativo === false) return Response.json({ error: 'Você não pode desativar sua própria conta' }, { status: 422 })
    if (body.permissions && !body.permissions.some((p) => TENANT_ADMIN_PERMS.includes(p))) {
      return Response.json({ error: 'Você não pode remover suas próprias permissões administrativas' }, { status: 422 })
    }
  }

  if (body.permissions) {
    const invalid = body.permissions.find((p) => !VALID_PERMISSIONS.includes(p as Permission))
    if (invalid) return Response.json({ error: `Permissão inválida: ${invalid}` }, { status: 400 })

    // Tenant admin não pode conceder SUPER_ADMIN_GLOBAIS
    if (!isSuperAdmin && body.permissions.includes('SUPER_ADMIN_GLOBAIS')) {
      return Response.json({ error: 'Sem permissão para conceder Super Admin' }, { status: 403 })
    }
  }

  const tenantId = target.tenantId

  if (body.email) {
    const conflict = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: body.email.trim().toLowerCase() } },
      select: { id: true },
    })
    if (conflict && conflict.id !== id) return Response.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })
  }

  const data: Record<string, unknown> = {}
  if (body.nome !== undefined) data.nome = body.nome.trim()
  if (body.email !== undefined) data.email = body.email.trim().toLowerCase()
  if (body.senha) data.senhaHash = await bcrypt.hash(body.senha, 12)
  if (body.permissions !== undefined) data.permissions = body.permissions as Permission[]
  if (body.crf !== undefined) data.crf = body.crf?.trim() || null
  if (body.ativo !== undefined) data.ativo = body.ativo

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, tenantId: true, nome: true, email: true, permissions: true, crf: true, ativo: true, createdAt: true },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: { tenantId, userId: session.user.id, acao: AuditAcao.USUARIO_ATUALIZADO, recursoTipo: 'User', recursoId: id, ip, userAgent: ua },
  })

  return Response.json({ user })
}
