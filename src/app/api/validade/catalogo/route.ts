import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Autocomplete do catálogo de produtos para o formulário de cadastro de lote
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId } = session.user
  const q = new URL(req.url).searchParams.get('q') ?? ''

  const produtos = await prisma.produtoCatalogo.findMany({
    where: {
      tenantId,
      ativo: true,
      nome: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, nome: true, fabricante: true, unidadePadrao: true },
    orderBy: { nome: 'asc' },
    take: 20,
  })

  return NextResponse.json(produtos)
}
