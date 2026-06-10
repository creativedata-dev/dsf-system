import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { tenantId, permissions } = session.user
  if (!permissions.includes('POPS_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const { id: documentoId } = await params

  const [usuarios, assinaturas] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nome: true, email: true, permissions: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.assinaturaPOP.findMany({
      where: { documentoId, tenantId, aprovado: true },
      select: { usuarioId: true, createdAt: true, termoAceitoEm: true, acertos: true, totalQuestoes: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Uma entrada por usuário — pega a mais recente (já ordenado desc)
  const mapaAssinaturas = new Map<string, typeof assinaturas[0]>()
  for (const a of assinaturas) {
    if (!mapaAssinaturas.has(a.usuarioId)) mapaAssinaturas.set(a.usuarioId, a)
  }

  const resultado = usuarios.map(u => {
    const assinatura = mapaAssinaturas.get(u.id)
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      concluido: !!assinatura,
      concluidoEm: assinatura?.termoAceitoEm ?? assinatura?.createdAt ?? null,
      acertos: assinatura?.acertos ?? null,
      totalQuestoes: assinatura?.totalQuestoes ?? null,
    }
  })

  return NextResponse.json(resultado)
}
