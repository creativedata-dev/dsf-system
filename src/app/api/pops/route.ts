import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, id: userId } = session.user

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })

  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'POPS')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  // Busca POPs: globais (tenantId=null) + específicos do tenant
  const [globais, proprios] = await Promise.all([
    prisma.documentoPOP.findMany({
      where: { tenantId: null, vigente: true },
      select: { id: true, codigo: true, titulo: true, versao: true, minAcertos: true, baseLegal: true, objetivo: true },
      orderBy: { codigo: 'asc' },
    }),
    prisma.documentoPOP.findMany({
      where: { tenantId, vigente: true },
      select: { id: true, codigo: true, titulo: true, versao: true, minAcertos: true, baseLegal: true, objetivo: true },
      orderBy: { codigo: 'asc' },
    }),
  ])

  // Merge: tenant-específico sobrepõe o global de mesmo código
  const propiosCodigos = new Set(proprios.map(p => p.codigo))
  const merged = [
    ...globais.filter(g => !propiosCodigos.has(g.codigo)),
    ...proprios,
  ].sort((a, b) => a.codigo.localeCompare(b.codigo))

  // Busca assinaturas aprovadas do usuário atual para indicar status de conclusão
  const assinaturas = await prisma.assinaturaPOP.findMany({
    where: {
      tenantId,
      usuarioId: userId,
      aprovado: true,
      documentoId: { in: merged.map(p => p.id) },
    },
    select: { documentoId: true },
  })

  const concluidos = new Set(assinaturas.map(a => a.documentoId))

  const pops = merged.map(p => ({
    ...p,
    concluido: concluidos.has(p.id),
    totalQuestoes: 3, // sempre 3 no padrão
  }))

  return NextResponse.json(pops)
}
