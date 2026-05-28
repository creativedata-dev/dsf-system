import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

const ADMIN_PERMS = ['SUPER_ADMIN_GLOBAIS', 'ANVISA_RELATORIOS', 'DSF_CANCELAR', 'DRIVE_CONFIGURAR']

async function resolveCliente(id: string, session: { user: { tenantId: string; permissions: string[] } }) {
  const perms = session.user.permissions as string[]
  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true, tenantId: true, nome: true, cpf: true, rg: true,
      dataNascimento: true, sexo: true, telefone: true, email: true,
      endereco: true, consentimentoLgpdAt: true, createdAt: true, updatedAt: true,
    },
  })

  if (!cliente) return null
  if (!isSuperAdmin && cliente.tenantId !== session.user.tenantId) return null
  return cliente
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.some((p) => ADMIN_PERMS.includes(p))) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const cliente = await resolveCliente(id, session)
  if (!cliente) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const dsfs = await prisma.dSF.findMany({
    where: { clienteId: id },
    select: {
      id: true,
      numeroDsf: true,
      tipoServico: true,
      dataEmissao: true,
      status: true,
      driveFileId: true,
      observacoes: true,
      responsavelTecnico: { select: { nome: true, crf: true } },
      atendente: { select: { nome: true } },
      insumos: {
        select: { nomeProduto: true, lote: true, fabricante: true, validade: true, quantidade: true, unidade: true },
      },
    },
    orderBy: { dataEmissao: 'desc' },
  })

  return Response.json({
    cliente: {
      ...cliente,
      dataNascimento: cliente.dataNascimento.toISOString(),
      consentimentoLgpdAt: cliente.consentimentoLgpdAt.toISOString(),
      createdAt: cliente.createdAt.toISOString(),
      updatedAt: cliente.updatedAt.toISOString(),
    },
    dsfs: dsfs.map((d) => ({
      id: d.id,
      numeroDsf: d.numeroDsf,
      tipoServico: d.tipoServico,
      tipoServicoLabel: TIPO_SERVICO_LABELS[d.tipoServico] ?? d.tipoServico,
      dataEmissao: d.dataEmissao.toISOString(),
      status: d.status,
      driveFileId: d.driveFileId,
      observacoes: d.observacoes,
      rtNome: d.responsavelTecnico.nome,
      rtCrf: d.responsavelTecnico.crf,
      atendenteNome: d.atendente.nome,
      insumos: d.insumos.map((i) => ({
        ...i,
        validade: i.validade.toISOString(),
        quantidade: Number(i.quantidade),
      })),
    })),
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.some((p) => ADMIN_PERMS.includes(p))) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const cliente = await resolveCliente(id, session)
  if (!cliente) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

  let body: { nome?: string; telefone?: string; email?: string; rg?: string; endereco?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.nome !== undefined) data.nome = body.nome.trim()
  if (body.telefone !== undefined) data.telefone = body.telefone.trim()
  if (body.email !== undefined) data.email = body.email?.trim() || null
  if (body.rg !== undefined) data.rg = body.rg?.trim() || null
  if (body.endereco !== undefined) data.endereco = body.endereco.trim()

  const updated = await prisma.cliente.update({
    where: { id },
    data,
    select: {
      id: true, nome: true, cpf: true, rg: true, telefone: true,
      email: true, endereco: true, updatedAt: true,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip') ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId: cliente.tenantId,
      userId: session.user.id,
      acao: AuditAcao.CLIENTE_ATUALIZADO,
      recursoTipo: 'Cliente',
      recursoId: id,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({ ...updated, updatedAt: updated.updatedAt.toISOString() })
}
