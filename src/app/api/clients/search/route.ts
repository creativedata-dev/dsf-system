import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const cpf = request.nextUrl.searchParams.get('cpf')?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) {
    return Response.json({ error: 'CPF inválido' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({
    where: { tenantId_cpf: { tenantId: session.user.tenantId, cpf } },
    select: {
      id: true,
      nome: true,
      cpf: true,
      rg: true,
      dataNascimento: true,
      sexo: true,
      telefone: true,
      email: true,
      endereco: true,
      consentimentoLgpdAt: true,
      updatedAt: true,
    },
  })

  if (!cliente) return Response.json(null, { status: 404 })

  return Response.json(cliente)
}
