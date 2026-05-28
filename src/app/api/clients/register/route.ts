import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

interface EnderecoInput {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

interface RegisterBody {
  nome: string
  cpf: string
  dataNascimento: string  // YYYY-MM-DD
  sexo: string
  telefone: string
  email?: string
  rg?: string
  endereco: EnderecoInput
}

function formatEndereco(e: EnderecoInput): string {
  const comp = e.complemento?.trim() ? `, ${e.complemento.trim()}` : ''
  return `${e.logradouro}, ${e.numero}${comp} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP: ${e.cep}`
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('CLIENTE_CADASTRAR')) {
    return Response.json({ error: 'Sem permissão para cadastrar clientes' }, { status: 403 })
  }

  let body: RegisterBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { nome, cpf, dataNascimento, sexo, telefone, email, rg, endereco } = body

  const cpfDigits = cpf?.replace(/\D/g, '')
  if (
    !nome?.trim() ||
    !cpfDigits || cpfDigits.length !== 11 ||
    !dataNascimento ||
    !['M', 'F', 'Outro'].includes(sexo) ||
    !telefone?.trim()
  ) {
    return Response.json(
      { error: 'Campos obrigatórios: nome, cpf, dataNascimento, sexo, telefone' },
      { status: 400 },
    )
  }

  if (!endereco?.logradouro?.trim() || !endereco?.numero?.trim() || !endereco?.bairro?.trim() || !endereco?.cidade?.trim() || !endereco?.uf?.trim()) {
    return Response.json({ error: 'Endereço incompleto' }, { status: 400 })
  }

  const tenantId = session.user.tenantId

  const existing = await prisma.cliente.findUnique({
    where: { tenantId_cpf: { tenantId, cpf: cpfDigits } },
    select: { id: true },
  })

  if (existing) {
    return Response.json({ error: 'Este CPF já está cadastrado' }, { status: 409 })
  }

  const cliente = await prisma.cliente.create({
    data: {
      tenantId,
      nome: nome.trim(),
      cpf: cpfDigits,
      rg: rg?.trim() || null,
      dataNascimento: new Date(dataNascimento),
      sexo,
      telefone: telefone.trim(),
      email: email?.trim() || null,
      endereco: formatEndereco(endereco),
      consentimentoLgpdAt: new Date(),
    },
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
      updatedAt: true,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.CLIENTE_CRIADO,
      recursoTipo: 'Cliente',
      recursoId: cliente.id,
      ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json(cliente, { status: 201 })
}
