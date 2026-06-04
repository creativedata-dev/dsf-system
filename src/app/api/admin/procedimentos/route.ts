import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TipoServico } from '@/generated/prisma/client'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

const TODOS_TIPOS = Object.values(TipoServico)

// GET — retorna todos os 11 tipos com a config do tenant (ativo + textoOrientacao)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DRIVE_CONFIGURAR') && !perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tenantId = perms.includes('SUPER_ADMIN_GLOBAIS')
    ? (searchParams.get('tenantId') ?? session.user.tenantId)
    : session.user.tenantId

  const configs = await prisma.procedimentoConfig.findMany({
    where: { tenantId },
    select: { tipoServico: true, ativo: true, textoOrientacao: true },
  })

  const configMap = Object.fromEntries(configs.map((c) => [c.tipoServico, c]))

  const procedimentos = TODOS_TIPOS.map((tipo) => ({
    tipoServico: tipo,
    label: TIPO_SERVICO_LABELS[tipo] ?? tipo,
    ativo: configMap[tipo]?.ativo ?? true,           // default ativo se ainda sem config
    textoOrientacao: configMap[tipo]?.textoOrientacao ?? null,
  }))

  return Response.json({ procedimentos })
}

// PUT — salva configs (upsert individual por NeonHttp)
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DRIVE_CONFIGURAR') && !perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: { tenantId?: string; procedimentos: { tipoServico: string; ativo: boolean; textoOrientacao: string | null }[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const tenantId = perms.includes('SUPER_ADMIN_GLOBAIS') && body.tenantId
    ? body.tenantId
    : session.user.tenantId

  const invalidos = body.procedimentos.filter((p) => !TODOS_TIPOS.includes(p.tipoServico as TipoServico))
  if (invalidos.length) {
    return Response.json({ error: `tipoServico inválido: ${invalidos[0].tipoServico}` }, { status: 400 })
  }

  // NeonHttp não suporta $transaction — upserts individuais em paralelo
  await Promise.all(
    body.procedimentos.map((p) =>
      prisma.procedimentoConfig.upsert({
        where: { tenantId_tipoServico: { tenantId, tipoServico: p.tipoServico as TipoServico } },
        create: {
          tenantId,
          tipoServico: p.tipoServico as TipoServico,
          ativo: p.ativo,
          textoOrientacao: p.textoOrientacao?.trim() || null,
        },
        update: {
          ativo: p.ativo,
          textoOrientacao: p.textoOrientacao?.trim() || null,
        },
      })
    )
  )

  return Response.json({ ok: true })
}
