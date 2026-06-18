import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
      endereco: true,
      telefone: true,
      alvaraSanitario: true,
      tipoImpressao: true,
      logoUrl: true,
    },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

  return NextResponse.json(tenant)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: {
    nomeFantasia?: string
    razaoSocial?: string
    cnpj?: string
    endereco?: string
    telefone?: string
    alvaraSanitario?: string
    tipoImpressao?: string
    logoUrl?: string | null
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const tenantId = session.user.tenantId

  if (body.cnpj !== undefined) {
    const cnpjClean = body.cnpj.replace(/\D/g, '')
    if (cnpjClean.length !== 14) return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    const conflict = await prisma.tenant.findUnique({ where: { cnpj: cnpjClean }, select: { id: true } })
    if (conflict && conflict.id !== tenantId) {
      return NextResponse.json({ error: 'CNPJ já cadastrado em outro estabelecimento' }, { status: 409 })
    }
    body.cnpj = cnpjClean
  }

  const data: Record<string, unknown> = {}
  if (body.nomeFantasia !== undefined) data.nomeFantasia = body.nomeFantasia.trim()
  if (body.razaoSocial !== undefined) data.razaoSocial = body.razaoSocial.trim()
  if (body.cnpj !== undefined) data.cnpj = body.cnpj
  if (body.endereco !== undefined) data.endereco = body.endereco.trim()
  if (body.telefone !== undefined) data.telefone = body.telefone.trim()
  if (body.alvaraSanitario !== undefined) data.alvaraSanitario = body.alvaraSanitario.trim()
  if (body.tipoImpressao !== undefined && ['BOBINA_80MM', 'FOLHA_A4'].includes(body.tipoImpressao)) {
    data.tipoImpressao = body.tipoImpressao
  }
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl ?? null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  await prisma.tenant.update({ where: { id: tenantId }, data })

  return NextResponse.json({ ok: true })
}
