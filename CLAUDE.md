@AGENTS.md

# CLAUDE.md — FarmaSign

## Visão Geral
SaaS multi-tenant de conformidade farmacêutica (ANVISA RDC 44/2009).
Produção: https://app.farmasign.com.br
Repositório: https://github.com/creativedata-dev/dsf-system
Branch prod: `master` | Branch dev: `dev`

## Stack
- Next.js 16 App Router + TypeScript strict
- Prisma 7.8 + Neon PostgreSQL serverless (HTTP adapter)
- NextAuth v4 + JWT (PBAC — array de permissões por usuário)
- Tailwind CSS 4, React 19, PWA (service worker manual)
- Google Drive API v3 por tenant, Stripe SDK 17, AES-256-GCM

## Restrição Crítica — NeonHttp
O adapter `@prisma/adapter-neon` NÃO suporta transações interativas.

NUNCA usar:
- `prisma.$transaction()`
- `prisma.model.createMany()`
- `prisma.model.upsert()`
- `prisma.model.update({ data, include: {...} })` — update com include dispara transação

SEMPRE usar:
- `Promise.all(items.map(i => prisma.model.create({ data: i })))` para creates múltiplos
- `find + create/update` manual para upsert
- Para update com retorno enriquecido: `update()` separado + `findUnique({ include })`

## Restrição Crítica — Prisma CLI
O binário `prisma` local (`node_modules/prisma/build/index.js`) **não existe** na instalação atual (Prisma 7.8 reestruturou o pacote). `npx prisma` e `node_modules/.bin/prisma` falham com MODULE_NOT_FOUND.

Workarounds:
- Migrations: criar a pasta `prisma/migrations/TIMESTAMP_nome/migration.sql` manualmente e aplicar o SQL direto no Neon via script Node com `@neondatabase/serverless`
- Regenerar client: editar manualmente `src/generated/prisma/models/*.ts` para refletir alterações de schema
- `prisma generate` no build do Vercel funciona pois usa outro contexto — não precisa funcionar localmente

## Multi-Tenancy
Isolamento lógico por `tenantId` em todas as tabelas operacionais.
Toda query de leitura/escrita deve incluir `where: { tenantId: session.user.tenantId }`.
Nunca confiar no frontend para passar tenantId — sempre extrair da sessão.

## PBAC — Permissões
Permissões disponíveis: `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR`,
`DSF_CANCELAR`, `ANVISA_RELATORIOS`, `DRIVE_CONFIGURAR`, `TEMPERATURA_GERENCIAR`,
`EQUIPAMENTOS_GERENCIAR`, `POPS_GERENCIAR`, `VALIDADE_GERENCIAR`,
`PAINEL_FISCAL_GERENCIAR`, `FRACIONAMENTO_GERENCIAR`, `SUPER_ADMIN_GLOBAIS`.

Verificar permissão em toda API route protegida:
```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.permissions?.includes('PERMISSAO_NECESSARIA')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

## Sistema de Módulos
`modulosHabilitados String[]` no tenant controla acesso às features.
Usar `hasModulo(modulosHabilitados, 'SLUG')` de `src/lib/modulos.ts`.
Array vazio = todos os módulos habilitados (retrocompatibilidade).

Slugs: `DSF`, `TEMPERATURA`, `EQUIPAMENTOS`, `POPS`, `VALIDADE`,
`PAINEL_FISCAL`, `FRACIONAMENTO`.

## Estrutura de API Routes
Todas as rotas em `src/app/api/`. Padrão de resposta de erro: `{ "error": "mensagem" }`.
Autenticação via NextAuth cookie `next-auth.session-token`.
Rotas admin em `/api/api/` exigem permissões elevadas.
Crons em `/api/cron/` autenticados via `Authorization: Bearer {CRON_SECRET}`.
Rota pública: `POST /api/onboarding` — sem autenticação, rate-limit por IP.

## Criptografia
`src/lib/crypto.ts` — AES-256-GCM para tokens Drive e chaves de gateway.
Formato: `base64(iv[12] | tag[16] | ciphertext)`.
Chave: `DRIVE_TOKEN_ENCRYPTION_KEY` (64 hex = 32 bytes).
NUNCA alterar a chave após dados gravados no banco.

## Padrões de Código
- Componentes server por padrão; `"use client"` apenas quando necessário
- Sem `<form>` HTML nativo — usar event handlers (`onClick`, `onChange`)
- Soft-delete com flag `ativo: Boolean` (nunca delete físico em registros críticos)
- Registros de conformidade (temperatura, AssinaturaPOP) são imutáveis após criação
- Todo AuditLog inclui IP real e User-Agent
- Prefixo de tabelas no banco: padrão Prisma (sem prefixo customizado)
- Hydration mismatch em Client Components que usam `usePathname()` para CSS condicional:
  usar `useLayoutEffect` + state local inicializado como `null` (null no SSR → valor real no cliente)

## Impressão
`Tenant.tipoImpressao`:
- `BOBINA_80MM` → cupom térmico 72mm (`@page { size: 80mm auto }`)
- `FOLHA_A4` → relatório clínico A4

CSS `@media print`: NUNCA usar `position: fixed` — causa repetição em cada página impressa. Usar `position: absolute`.

## Geração de PDF
- `src/lib/pdf-temperatura.ts` — histórico de temperatura (pdf-lib)
- `src/lib/pdf-etiqueta.ts` — etiquetas 80x50mm com QR Code (pdf-lib + qrcode)

## Navegação — Router Cache (Next.js App Router)
`router.push()` pode servir RSC payload cacheado de sessão anterior → hydration mismatch e dados stale.
SEMPRE usar `window.location.href = '/dashboard'` no login (hard navigation limpa o cache).
Layout do dashboard tem `export const dynamic = 'force-dynamic'` para evitar cache SSR.

## Mobile — DashboardShell
`src/components/dashboard-shell.tsx`:
- Desktop (lg+): sidebar fixo à esquerda
- Mobile: header sticky + **bottom tab bar** (Início + até 2 módulos primários + Config. + Mais)
- "Mais" abre drawer lateral com navegação completa
- Bottom nav usa `clientPathname` (null no SSR via `useLayoutEffect`) para evitar hydration mismatch

## Onboarding Automático (Landing Page)
`POST /api/onboarding` — endpoint público, sem auth:
- Body: `{ nomeFantasia, responsavelNome, email, senha }`
- Cria Tenant + User (admin completo, sem SUPER_ADMIN_GLOBAIS) + Assinatura TRIAL
- Campos `razaoSocial`, `cnpj`, `endereco`, `telefone`, `alvaraSanitario` são opcionais no Tenant
- Rate-limit: 1 req/IP/minuto via Map em memória
- Retorna `{ ok: true, email }` — landing page chama `signIn('credentials', {...})` depois
- Dashboard home exibe welcome banner com checklist de 4 passos até setup completo

## Web Push Notifications (Entregue)
- `PushSubscription` e `ConfigAlerta` models no banco
- `POST/DELETE /api/notificacoes/subscribe` — gerencia subscription do browser
- `GET/PATCH /api/notificacoes/config` — configurações por tenant
- `POST /api/notificacoes/test` — envia push de teste
- `src/lib/web-push.ts` — helper VAPID com limpeza de endpoints expirados (410/404)
- `public/sw.js` — handlers `push` e `notificationclick`
- Crons `alertas-temperatura`, `alertas-equipamentos`, `alertas-validade` integrados
- Env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

## Módulos Entregues (v1 — Produção)
DSF, Temperatura/Umidade, Equipamentos/Calibração, POPs+E-learning,
Painel do Fiscal (link temporário público), Validade/Quarentena, Fracionamento+QR,
Web Push Notifications, Onboarding via landing page.

## Comandos Úteis
```bash
npm run dev                     # dev com Turbopack

# Prisma CLI está quebrado localmente (Prisma 7.8 — build/index.js ausente)
# Para aplicar migration manual no Neon:
node -e "
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)
sql\`ALTER TABLE ...\`.then(() => console.log('ok'))
"

npx tsx prisma/seed.ts          # seed de desenvolvimento
npx tsx prisma/seed-pops.ts     # seed idempotente dos 10 POPs padrão
```

## Deploy
- Push para `master` → GitHub Actions → Vercel prod automático
- Preview: `npx vercel --scope creative-data-projects`
- Prod manual: `npx vercel --prod --scope creative-data-projects`
- Token Vercel deve ser da conta `creative-data-projects`
- Build no Vercel executa `prisma generate && next build` — funciona mesmo com CLI local quebrado
