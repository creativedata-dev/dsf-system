import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'
import { gerarEtiquetaPDF } from '@/lib/pdf-etiqueta'

// GET /api/fracionamento/[id]/etiqueta
// [id] = FracionamentoLote.id — gera etiquetas para todas as frações ou uma só via ?fracaoId=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId, id: userId } = session.user
  const { id } = await params

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true, nomeFantasia: true },
  })
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'FRACIONAMENTO')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const fracionamento = await prisma.fracionamentoLote.findUnique({
    where: { id },
    include: {
      lote: { include: { produto: { select: { nome: true } } } },
      fracoes: { orderBy: { numero: 'asc' } },
    },
  })

  if (!fracionamento || fracionamento.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Fracionamento não encontrado' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const fracaoId = searchParams.get('fracaoId')

  const fracoesAlvo = fracaoId
    ? fracionamento.fracoes.filter(f => f.id === fracaoId)
    : fracionamento.fracoes

  if (fracoesAlvo.length === 0) {
    return NextResponse.json({ error: 'Fração não encontrada' }, { status: 404 })
  }

  const dadosEtiquetas = fracoesAlvo.map(fr => ({
    fracionamentoId: fracionamento.id,
    fracaoId: fr.id,
    numero: fr.numero,
    totalFracoes: fracionamento.totalFracoes,
    nomeProduto: fracionamento.lote.produto.nome,
    fabricante: fracionamento.lote.fabricante,
    lote: fracionamento.lote.lote,
    validade: fracionamento.lote.validade,
    quantidade: Number(fr.quantidade),
    unidade: fr.unidade,
    destinacao: fr.destinacao,
    nomeFantasia: tenant!.nomeFantasia,
    dataFracionamento: fracionamento.dataFracionamento,
  }))

  const pdfBytes = await gerarEtiquetaPDF(dadosEtiquetas)

  // Marca etiquetas como impressas
  const agora = new Date()
  await Promise.all(
    fracoesAlvo.map(fr =>
      prisma.fracaoItem.update({
        where: { id: fr.id },
        data: { etiquetaImpressaEm: agora },
      }),
    ),
  )

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: 'ETIQUETA_IMPRESSA',
      recursoTipo: 'FracionamentoLote',
      recursoId: fracionamento.id,
      ip,
      userAgent,
    },
  })

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="etiquetas-${fracionamento.id.slice(0, 8)}.pdf"`,
    },
  })
}
