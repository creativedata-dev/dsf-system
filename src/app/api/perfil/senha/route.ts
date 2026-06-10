import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { senhaAtual, novaSenha } = await req.json()
    if (!senhaAtual || !novaSenha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (novaSenha.length < 6) {
      return NextResponse.json({ error: 'Nova senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { senhaHash: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const ok = await bcrypt.compare(senhaAtual, user.senhaHash)
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

    const hash = await bcrypt.hash(novaSenha, 10)
    await prisma.user.update({ where: { id: session.user.id }, data: { senhaHash: hash } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/perfil/senha error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
