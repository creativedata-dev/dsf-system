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

function formatEndereco(e: EnderecoInput): string {
  const comp = e.complemento?.trim() ? `, ${e.complemento.trim()}` : ''
  return `${e.logradouro}, ${e.numero}${comp} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP: ${e.cep}`
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  let body: {
    id: string
    nome: string
    telefone: string
    email?: string
    rg?: string
    endereco: EnderecoInput | string
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const { id, nome, telefone, email, rg, endereco } = body

  if (!id || !nome?.trim() || !telefone?.trim() || !endereco) {
    return Response.json({ error: 'Campos obrigatórios ausentes: id, nome, telefone, endereco' }, { status: 400 })
  }

  // Tenant isolation — verifica se o cliente pertence ao tenant da sessão
  const existing = await prisma.cliente.findUnique({
    where: { id },
    select: { tenantId: true },
  })

  if (!existing) {
    return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  if (existing.tenantId !== session.user.tenantId) {
    return Response.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const enderecoStr = typeof endereco === 'string' ? endereco : formatEndereco(endereco)

  const updated = await prisma.cliente.update({
    where: { id },
    data: {
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email?.trim() || null,
      rg: rg?.trim() || null,
      endereco: enderecoStr,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      acao: AuditAcao.CLIENTE_ATUALIZADO,
      recursoTipo: 'Cliente',
      recursoId: id,
      ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json(updated)
}
