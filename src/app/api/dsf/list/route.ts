import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DsfStatus, TipoServico } from '@/generated/prisma/client'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('ANVISA_RELATORIOS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const status = searchParams.get('status')
  const tipoServico = searchParams.get('tipoServico')
  const format = searchParams.get('format') // 'csv' ou nulo

  const tenantId = session.user.tenantId

  const where = {
    tenantId,
    ...(status && Object.values(DsfStatus).includes(status as DsfStatus) ? { status: status as DsfStatus } : {}),
    ...(tipoServico && Object.values(TipoServico).includes(tipoServico as TipoServico) ? { tipoServico: tipoServico as TipoServico } : {}),
    ...(dateFrom || dateTo
      ? {
          dataEmissao: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
          },
        }
      : {}),
  }

  const select = {
    id: true,
    numeroDsf: true,
    tipoServico: true,
    dataEmissao: true,
    status: true,
    driveFileId: true,
    observacoes: true,
    cliente: { select: { id: true, nome: true, cpf: true, email: true } },
    responsavelTecnico: { select: { nome: true, crf: true } },
    atendente: { select: { nome: true } },
  }

  if (format === 'csv') {
    const dsfs = await prisma.dSF.findMany({
      where,
      select,
      orderBy: { dataEmissao: 'desc' },
    })

    const header = 'Número DSF,Data Emissão,Status,Tipo de Serviço,Cliente,CPF,Responsável Técnico,CRF,Atendente'
    const rows = dsfs.map((d) => {
      const data = new Date(d.dataEmissao).toLocaleDateString('pt-BR')
      const tipo = TIPO_SERVICO_LABELS[d.tipoServico] ?? d.tipoServico
      return [
        d.numeroDsf,
        data,
        d.status,
        `"${tipo}"`,
        `"${d.cliente.nome}"`,
        d.cliente.cpf,
        `"${d.responsavelTecnico.nome}"`,
        d.responsavelTecnico.crf ?? '',
        `"${d.atendente.nome}"`,
      ].join(',')
    })

    const csv = '﻿' + [header, ...rows].join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dsf-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  const [total, dsfs] = await Promise.all([
    prisma.dSF.count({ where }),
    prisma.dSF.findMany({
      where,
      select,
      orderBy: { dataEmissao: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  return Response.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    dsfs: dsfs.map((d) => ({
      id: d.id,
      numeroDsf: d.numeroDsf,
      tipoServico: d.tipoServico,
      tipoServicoLabel: TIPO_SERVICO_LABELS[d.tipoServico] ?? d.tipoServico,
      dataEmissao: d.dataEmissao.toISOString(),
      status: d.status,
      driveFileId: d.driveFileId,
      observacoes: d.observacoes,
      clienteId: d.cliente.id,
      clienteNome: d.cliente.nome,
      clienteCpf: d.cliente.cpf,
      clienteEmail: d.cliente.email,
      rtNome: d.responsavelTecnico.nome,
      rtCrf: d.responsavelTecnico.crf,
      atendenteNome: d.atendente.nome,
    })),
  })
}
