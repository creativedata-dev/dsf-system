import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, Permission, TipoServico } from '@/generated/prisma/client'
import { generateDsfPdf } from '@/lib/pdf-dsf'
import { uploadPdfToDrive } from '@/lib/drive'

interface InsumoInput {
  nomeProduto: string
  lote: string
  fabricante: string
  validade: string  // ISO date string YYYY-MM-DD
  quantidade?: number
}

interface CreateDsfBody {
  clienteId: string
  tipoServico: string
  observacoes?: string
  insumos: InsumoInput[]
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DSF_EMITIR')) {
    return Response.json({ error: 'Sem permissão para emitir DSF' }, { status: 403 })
  }

  let body: CreateDsfBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { clienteId, tipoServico, observacoes, insumos } = body

  if (!clienteId || !tipoServico || !Object.values(TipoServico).includes(tipoServico as TipoServico)) {
    return Response.json({ error: 'clienteId e tipoServico válido são obrigatórios' }, { status: 400 })
  }

  const tenantId = session.user.tenantId

  // ── Confirmar que o cliente pertence ao tenant ──────────────────────────────
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, tenantId: true, nome: true, cpf: true, dataNascimento: true, telefone: true, endereco: true },
  })
  if (!cliente || cliente.tenantId !== tenantId) {
    return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  // ── Responsável Técnico ─────────────────────────────────────────────────────
  // Se o operador tem ANVISA_RELATORIOS, ele mesmo é o RT.
  // Caso contrário, busca o primeiro farmacêutico ativo do tenant.
  let responsavelTecnico: { id: string; nome: string; crf: string | null }

  if (perms.includes('ANVISA_RELATORIOS')) {
    responsavelTecnico = { id: session.user.id, nome: session.user.name ?? '', crf: session.user.crf ?? null }
  } else {
    const rt = await prisma.user.findFirst({
      where: { tenantId, ativo: true, permissions: { has: Permission.ANVISA_RELATORIOS } },
      select: { id: true, nome: true, crf: true },
    })
    if (!rt) {
      return Response.json(
        { error: 'Nenhum Responsável Técnico habilitado encontrado no tenant' },
        { status: 422 },
      )
    }
    responsavelTecnico = rt
  }

  // ── Número sequencial da DSF por tenant/ano ─────────────────────────────────
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const count = await prisma.dSF.count({ where: { tenantId, createdAt: { gte: startOfYear } } })
  const numeroDsf = `DSF-${year}-${String(count + 1).padStart(5, '0')}`

  // ── Criar DSF ───────────────────────────────────────────────────────────────
  const dsf = await prisma.dSF.create({
    data: {
      tenantId,
      numeroDsf,
      clienteId,
      responsavelTecnicoId: responsavelTecnico.id,
      atendenteId: session.user.id,
      tipoServico: tipoServico as TipoServico,
      observacoes: observacoes?.trim() || null,
      status: 'EM_ANDAMENTO',
    },
  })

  // ── Criar insumos ────────────────────────────────────────────────────────────
  // createMany usa transação implícita — incompatível com NeonHttp. Usar creates paralelos.
  if (insumos.length > 0) {
    await Promise.all(
      insumos.map((ins) =>
        prisma.insumoDSF.create({
          data: {
            dsfId: dsf.id,
            nomeProduto: ins.nomeProduto.trim(),
            lote: ins.lote.trim(),
            fabricante: ins.fabricante.trim(),
            validade: new Date(ins.validade),
            quantidade: ins.quantidade ?? 1,
            unidade: 'un',
          },
        })
      )
    )
  }

  // ── Audit log ────────────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.DSF_CRIADA,
      recursoTipo: 'DSF',
      recursoId: dsf.id,
      ip,
      userAgent: ua,
    },
  })

  // ── Gerar PDF + upload Drive ─────────────────────────────────────────────────
  let driveFileId: string | null = null

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nomeFantasia: true, cnpj: true, telefone: true },
    })

    const insumosFull = await prisma.insumoDSF.findMany({
      where: { dsfId: dsf.id },
      select: { nomeProduto: true, lote: true, fabricante: true, validade: true },
    })

    const pdfBytes = await generateDsfPdf({
      numeroDsf,
      dataEmissao: dsf.dataEmissao,
      drogariaNome: tenant?.nomeFantasia ?? '',
      drogariaCnpj: tenant?.cnpj ?? '',
      drogariaTelefone: tenant?.telefone ?? '',
      rtNome: responsavelTecnico.nome,
      rtCrf: responsavelTecnico.crf,
      clienteNome: cliente.nome,
      clienteCpf: cliente.cpf,
      clienteDataNasc: cliente.dataNascimento,
      clienteTelefone: cliente.telefone,
      clienteEndereco: cliente.endereco,
      tipoServico,
      observacoes,
      insumos: insumosFull.map((i) => ({
        nomeProduto: i.nomeProduto,
        lote: i.lote,
        fabricante: i.fabricante,
        validade: i.validade,
      })),
    })

    driveFileId = await uploadPdfToDrive(tenantId, `${numeroDsf}.pdf`, pdfBytes)

    if (driveFileId) {
      await prisma.dSF.update({ where: { id: dsf.id }, data: { driveFileId, status: 'CONCLUIDA' } })
    }
  } catch (err) {
    console.error('[DSF] Falha no PDF/Drive:', err)
    // DSF já criada — falha silenciosa no upload não reverte o atendimento
  }

  return Response.json({
    id: dsf.id,
    numeroDsf,
    status: driveFileId ? 'CONCLUIDA' : 'EM_ANDAMENTO',
    driveFileId,
  })
}
