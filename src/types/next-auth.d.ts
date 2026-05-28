import { Permission } from '@/generated/prisma/client'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    tenantId: string
    permissions: Permission[]
    crf: string | null
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      tenantId: string
      permissions: Permission[]
      crf: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    tenantId: string
    permissions: Permission[]
    crf: string | null
  }
}
