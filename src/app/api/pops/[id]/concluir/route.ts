import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, id: userId } = session.user
  const { id } = await params

  const body = await req.json()
  const respostas: Record<string, string> = body.respostas ?? {}

  if (!respostas || typeof respostas !== 'object') {
    return NextResponse.json({ error: 'Respostas inválidas' }, { status: 400 })
  }

  // Verifica se usuário já concluiu (aprovado = true)
  const jaAprovado = await prisma.assinaturaPOP.findFirst({
    where: { documentoId: id, usuarioId: userId, tenantId, aprovado: true },
    select: { id: true },
  })

  if (jaAprovado) {
    return NextResponse.json({ jaConcluidoAntes: true, aprovado: true })
  }

  // Busca documento com questões e gabarito
  const doc = await prisma.documentoPOP.findUnique({
    where: { id },
    include: { questoes: { orderBy: { ordem: 'asc' } } },
  })

  if (!doc) return NextResponse.json({ error: 'POP não encontrado' }, { status: 404 })
  if (doc.tenantId !== null && doc.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // Calcula acertos
  let acertos = 0
  const feedback = doc.questoes.map(q => {
    const resposta = respostas[q.id]
    const correto = resposta === q.respostaCorreta
    if (correto) acertos++
    return {
      questaoId: q.id,
      correto,
      respostaCorreta: q.respostaCorreta,
      justificativa: q.justificativa,
    }
  })

  const totalQuestoes = doc.questoes.length
  const aprovado = acertos >= doc.minAcertos

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  // Registra tentativa (sempre); se aprovado, cria AssinaturaPOP definitiva
  await prisma.assinaturaPOP.create({
    data: {
      documentoId: id,
      tenantId,
      usuarioId: userId,
      acertos,
      totalQuestoes,
      aprovado,
      respostas,
      ipOrigem: ip,
      userAgent,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: aprovado ? 'POP_CONCLUIDO' : 'POP_REPROVADO',
      recursoTipo: 'DocumentoPOP',
      recursoId: id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json({
    aprovado,
    acertos,
    totalQuestoes,
    minAcertos: doc.minAcertos,
    feedback,
  })
}
