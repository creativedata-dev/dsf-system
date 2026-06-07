import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SELECT = {
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
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const cpfParam = request.nextUrl.searchParams.get('cpf')?.replace(/\D/g, '')

  // Busca exata por CPF (compatibilidade com fluxo legado)
  if (cpfParam) {
    if (cpfParam.length !== 11) return Response.json({ error: 'CPF inválido' }, { status: 400 })
    const cliente = await prisma.cliente.findUnique({
      where: { tenantId_cpf: { tenantId, cpf: cpfParam } },
      select: SELECT,
    })
    return cliente ? Response.json(cliente) : Response.json(null, { status: 404 })
  }

  if (!q || q.length < 2) {
    return Response.json({ error: 'Mínimo 2 caracteres' }, { status: 400 })
  }

  const digits = q.replace(/\D/g, '')
  const isCpf = digits.length >= 6 && /^\d[\d.\-]+$/.test(q)

  if (isCpf) {
    // Busca exata se CPF completo, parcial se incompleto
    if (digits.length === 11) {
      const cliente = await prisma.cliente.findUnique({
        where: { tenantId_cpf: { tenantId, cpf: digits } },
        select: SELECT,
      })
      return Response.json(cliente ? [cliente] : [])
    }
    // CPF parcial — busca por prefixo
    const clientes = await prisma.cliente.findMany({
      where: { tenantId, cpf: { startsWith: digits } },
      select: SELECT,
      take: 10,
      orderBy: { nome: 'asc' },
    })
    return Response.json(clientes)
  }

  // Busca por nome (qualquer parte, case-insensitive)
  const clientes = await prisma.cliente.findMany({
    where: {
      tenantId,
      nome: { contains: q, mode: 'insensitive' },
    },
    select: SELECT,
    take: 10,
    orderBy: { nome: 'asc' },
  })

  return Response.json(clientes)
}
