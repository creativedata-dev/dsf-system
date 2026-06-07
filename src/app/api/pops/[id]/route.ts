import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, id: userId } = session.user
  const { id } = await params

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })

  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'POPS')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const doc = await prisma.documentoPOP.findUnique({
    where: { id },
    include: { questoes: { orderBy: { ordem: 'asc' } } },
  })

  if (!doc) return NextResponse.json({ error: 'POP não encontrado' }, { status: 404 })

  // Verificar acesso: doc global (tenantId=null) ou do próprio tenant
  if (doc.tenantId !== null && doc.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // Busca última tentativa do usuário (aprovada ou não)
  const assinaturas = await prisma.assinaturaPOP.findMany({
    where: { documentoId: id, usuarioId: userId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })
  const ultimaTentativa = assinaturas[0] ?? null

  const jaAssinou = !!ultimaTentativa?.aprovado

  // Remove respostaCorreta das questões para não vazar pro frontend
  const questoesSemGabarito = doc.questoes.map(q => ({
    id: q.id,
    ordem: q.ordem,
    enunciado: q.enunciado,
    opcoes: q.opcoes,
  }))

  return NextResponse.json({
    id: doc.id,
    codigo: doc.codigo,
    titulo: doc.titulo,
    baseLegal: doc.baseLegal,
    objetivo: doc.objetivo,
    conteudo: doc.conteudo,
    versao: doc.versao,
    minAcertos: doc.minAcertos,
    questoes: questoesSemGabarito,
    jaAssinou,
    ultimaTentativa: ultimaTentativa
      ? {
          acertos: ultimaTentativa.acertos,
          totalQuestoes: ultimaTentativa.totalQuestoes,
          aprovado: ultimaTentativa.aprovado,
          createdAt: ultimaTentativa.createdAt,
        }
      : null,
  })
}
