import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Permission } from '@/generated/prisma/client'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, ativo: true },
        })

        if (!user) return null

        const senhaValida = await bcrypt.compare(credentials.password, user.senhaHash)
        if (!senhaValida) return null

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          tenantId: user.tenantId,
          permissions: user.permissions,
          crf: user.crf ?? null,
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tenantId = (user as { tenantId: string }).tenantId
        token.permissions = (user as { permissions: Permission[] }).permissions
        token.crf = (user as { crf: string | null }).crf
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.tenantId = token.tenantId as string
      session.user.permissions = (token.permissions as Permission[]) ?? []
      session.user.crf = (token.crf as string | null) ?? null
      return session
    },
  },

  pages: {
    signIn: '/auth/login',
  },
}
