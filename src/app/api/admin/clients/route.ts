import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_PERMS = ['SUPER_ADMIN_GLOBAIS', 'ANVISA_RELATORIOS', 'DSF_CANCELAR', 'DRIVE_CONFIGURAR']
const PAGE_SIZE = 25

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.some((p) => ADMIN_PERMS.includes(p))) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')
  const { searchParams } = new URL(request.url)

  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const q       = searchParams.get('q')?.trim() ?? ''
  const tenantFilter = isSuperAdmin ? (searchParams.get('tenantId') ?? '') : session.user.tenantId

  const where = {
    ...(tenantFilter ? { tenantId: tenantFilter } : {}),
    ...(q ? {
      OR: [
        { nome: { contains: q, mode: 'insensitive' as const } },
        { cpf:  { contains: q.replace(/\D/g, '') } },
      ],
    } : {}),
  }

  const [total, clientes] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        nome: true,
        cpf: true,
        dataNascimento: true,
        sexo: true,
        telefone: true,
        email: true,
        createdAt: true,
        _count: { select: { dsfs: true } },
      },
      orderBy: { nome: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  let tenants: { id: string; nomeFantasia: string }[] = []
  if (isSuperAdmin) {
    tenants = await prisma.tenant.findMany({
      select: { id: true, nomeFantasia: true },
      orderBy: { nomeFantasia: 'asc' },
    })
  }

  return Response.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    clientes: clientes.map((c) => ({
      ...c,
      dataNascimento: c.dataNascimento.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    tenants,
    isSuperAdmin,
  })
}
