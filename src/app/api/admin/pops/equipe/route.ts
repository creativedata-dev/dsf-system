import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { tenantId, permissions } = session.user
  if (!permissions.includes('POPS_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  // POPs vigentes para este tenant (global + próprios)
  const [globais, proprios] = await Promise.all([
    prisma.documentoPOP.findMany({
      where: { tenantId: null, vigente: true },
      select: { id: true, codigo: true, titulo: true },
      orderBy: { codigo: 'asc' },
    }),
    prisma.documentoPOP.findMany({
      where: { tenantId, vigente: true },
      select: { id: true, codigo: true, titulo: true },
      orderBy: { codigo: 'asc' },
    }),
  ])

  const propiosCodigos = new Set(proprios.map(p => p.codigo))
  const pops = [
    ...globais.filter(g => !propiosCodigos.has(g.codigo)),
    ...proprios,
  ].sort((a, b) => a.codigo.localeCompare(b.codigo))

  // Usuários ativos do tenant
  const usuarios = await prisma.user.findMany({
    where: { tenantId, ativo: true },
    select: { id: true, nome: true, email: true },
    orderBy: { nome: 'asc' },
  })

  // Assinaturas aprovadas
  const popIds = pops.map(p => p.id)
  const assinaturas = await prisma.assinaturaPOP.findMany({
    where: { tenantId, aprovado: true, documentoId: { in: popIds } },
    select: { usuarioId: true, documentoId: true },
  })

  // Deduplica — um par (usuarioId, documentoId) conta uma vez
  const concluidos = new Set(assinaturas.map(a => `${a.usuarioId}:${a.documentoId}`))

  return NextResponse.json({ usuarios, pops, concluidos: [...concluidos] })
}
