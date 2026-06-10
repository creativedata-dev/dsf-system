import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function requireGestor(permissions: string[]) {
  return permissions.includes('POPS_GERENCIAR') || permissions.includes('SUPER_ADMIN_GLOBAIS')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!requireGestor(session.user.permissions)) return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })

  const { id } = await params
  const doc = await prisma.documentoPOP.findUnique({
    where: { id },
    include: { questoes: { orderBy: { ordem: 'asc' } } },
  })
  if (!doc) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json(doc)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!requireGestor(session.user.permissions)) return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { codigo, titulo, baseLegal, objetivo, conteudo, versao, minAcertos, vigente, questoes } = body

  const doc = await prisma.documentoPOP.update({
    where: { id },
    data: {
      ...(codigo !== undefined && { codigo }),
      ...(titulo !== undefined && { titulo }),
      ...(baseLegal !== undefined && { baseLegal }),
      ...(objetivo !== undefined && { objetivo }),
      ...(conteudo !== undefined && { conteudo }),
      ...(versao !== undefined && { versao }),
      ...(minAcertos !== undefined && { minAcertos: Number(minAcertos) }),
      ...(vigente !== undefined && { vigente }),
    },
  })

  // Substitui questões se fornecidas
  if (Array.isArray(questoes)) {
    const existentes = await prisma.questaoQuiz.findMany({ where: { documentoId: id }, select: { id: true } })
    await Promise.all(existentes.map(q => prisma.questaoQuiz.delete({ where: { id: q.id } })))
    await Promise.all(
      questoes.map((q: any) =>
        prisma.questaoQuiz.create({
          data: {
            documentoId: id,
            ordem: q.ordem,
            enunciado: q.enunciado,
            opcoes: q.opcoes,
            respostaCorreta: q.respostaCorreta,
            justificativa: q.justificativa ?? null,
          },
        })
      )
    )
  }

  return NextResponse.json(doc)
}
