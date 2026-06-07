import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, permissions } = session.user
  if (!permissions.includes('POPS_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const [globais, proprios, totalUsuarios] = await Promise.all([
    prisma.documentoPOP.findMany({
      where: { tenantId: null, vigente: true },
      include: { questoes: { select: { id: true } } },
      orderBy: { codigo: 'asc' },
    }),
    prisma.documentoPOP.findMany({
      where: { tenantId, vigente: true },
      include: { questoes: { select: { id: true } } },
      orderBy: { codigo: 'asc' },
    }),
    prisma.user.count({ where: { tenantId, ativo: true } }),
  ])

  const propiosCodigos = new Set(proprios.map(p => p.codigo))
  const merged = [
    ...globais.filter(g => !propiosCodigos.has(g.codigo)).map(g => ({ ...g, origem: 'global' as const })),
    ...proprios.map(p => ({ ...p, origem: 'proprio' as const })),
  ].sort((a, b) => a.codigo.localeCompare(b.codigo))

  // Conta assinaturas aprovadas por documento
  const assinaturasPorDoc = await prisma.assinaturaPOP.groupBy({
    by: ['documentoId'],
    where: { tenantId, aprovado: true },
    _count: { id: true },
  })

  const countMap = new Map(assinaturasPorDoc.map(a => [a.documentoId, a._count.id]))

  const pops = merged.map(p => ({
    id: p.id,
    codigo: p.codigo,
    titulo: p.titulo,
    versao: p.versao,
    baseLegal: p.baseLegal,
    vigente: p.vigente,
    origem: p.origem,
    totalQuestoes: p.questoes.length,
    concluiuCount: countMap.get(p.id) ?? 0,
    totalUsuarios,
    createdAt: p.createdAt,
  }))

  return NextResponse.json(pops)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, permissions } = session.user
  if (!permissions.includes('POPS_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const body = await req.json()
  const { codigo, titulo, baseLegal, objetivo, conteudo, versao, minAcertos, questoes } = body

  if (!codigo || !titulo || !conteudo) {
    return NextResponse.json({ error: 'Campos obrigatórios: codigo, titulo, conteudo' }, { status: 400 })
  }

  const doc = await prisma.documentoPOP.create({
    data: {
      tenantId,
      codigo,
      titulo,
      baseLegal,
      objetivo,
      conteudo,
      versao: versao ?? '1.0',
      minAcertos: minAcertos ?? 2,
      vigente: true,
    },
  })

  if (Array.isArray(questoes) && questoes.length > 0) {
    await Promise.all(
      questoes.map((q: any) =>
        prisma.questaoQuiz.create({
          data: {
            documentoId: doc.id,
            ordem: q.ordem,
            enunciado: q.enunciado,
            opcoes: q.opcoes,
            respostaCorreta: q.respostaCorreta,
            justificativa: q.justificativa,
          },
        })
      )
    )
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: 'POP_CRIADO',
      recursoTipo: 'DocumentoPOP',
      recursoId: doc.id,
      ip: 'admin',
      userAgent: 'admin',
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
