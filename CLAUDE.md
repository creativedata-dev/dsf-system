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

## Impressão
`Tenant.tipoImpressao`:
- `BOBINA_80MM` → cupom térmico 72mm (`@page { size: 80mm auto }`)
- `FOLHA_A4` → relatório clínico A4

## Geração de PDF
- `src/lib/pdf-temperatura.ts` — histórico de temperatura (pdf-lib)
- `src/lib/pdf-etiqueta.ts` — etiquetas 80x50mm com QR Code (pdf-lib + qrcode)

## Módulos Entregues (v1 — Produção)
Todos os módulos do roadmap estão entregues e operacionais:
DSF, Temperatura/Umidade, Equipamentos/Calibração, POPs+E-learning,
Painel do Fiscal (link temporário público), Validade/Quarentena, Fracionamento+QR.

## Próxima Feature em Desenvolvimento
Web Push Notifications via PWA:
- `PushSubscription` model no banco (userId, tenantId, endpoint, keys)
- `POST /api/notificacoes/subscribe` — salva subscription
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` nas env vars
- Atualizar `public/sw.js` com handlers `push` e `notificationclick`
- `ConfigAlerta` model: horário limite temperatura, antecedência equipamentos, toggles por tipo
- Envio nos crons existentes: alertas-temperatura, alertas-equipamentos, alertas-validade
- Prioridade inicial: apenas alerta de temperatura não registrada (horário configurável por tenant)

## Comandos Úteis
```bash
npm run dev                          # dev com Turbopack
npx prisma migrate dev --name nome   # nova migration
npx prisma generate                  # regenerar client após schema change
npx prisma migrate deploy            # aplicar migrations em prod
npx tsx prisma/seed.ts               # seed de desenvolvimento
npx tsx prisma/seed-pops.ts          # seed idempotente dos 10 POPs padrão
```

## Deploy
- Push para `master` → GitHub Actions → Vercel prod automático
- Preview: `npx vercel --scope creative-data-projects`
- Prod manual: `npx vercel --prod --scope creative-data-projects`
- Token Vercel deve ser da conta `creative-data-projects`
