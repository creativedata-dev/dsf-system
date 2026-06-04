import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TipoServico } from '@/generated/prisma/client'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

const TODOS_TIPOS = Object.values(TipoServico)

// Retorna os procedimentos ativos do tenant da sessão (qualquer usuário logado)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const configs = await prisma.procedimentoConfig.findMany({
    where: { tenantId: session.user.tenantId },
    select: { tipoServico: true, ativo: true },
  })

  const configMap = Object.fromEntries(configs.map((c) => [c.tipoServico, c.ativo]))

  // Se não há nenhuma config salva ainda, todos estão ativos por padrão
  const options = TODOS_TIPOS
    .filter((tipo) => configMap[tipo] !== false)
    .map((tipo) => ({ value: tipo, label: TIPO_SERVICO_LABELS[tipo] ?? tipo }))

  return Response.json({ options })
}
