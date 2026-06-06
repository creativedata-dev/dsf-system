# Arquitetura — FarmaSign

## Visao Geral

SaaS multi-tenant para drogarias emitirem, armazenarem e auditarem **Declaracoes de Servicos Farmaceuticos (DSF)** em conformidade com ANVISA RDC 44/2009 e LGPD (Lei 13.709/2018).

URL de producao: `https://app.farmasign.com.br`

---

## Stack Tecnologica

| Camada | Tecnologia | Versao |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 (Turbopack) |
| Linguagem | TypeScript (strict) | 5.x |
| Runtime | React | 19.x |
| ORM | Prisma | 7.8.0 |
| Banco | Neon PostgreSQL (serverless, sa-east-1) | — |
| Adapter DB | `@prisma/adapter-neon` (HTTP) | 7.8.0 |
| Autenticacao | NextAuth.js v4 + JWT | 4.24.x |
| Pagamentos | Stripe SDK | 17.x |
| Armazenamento | Google Drive API v3 (por tenant) | googleapis 172 |
| Criptografia | AES-256-GCM (Node.js crypto) | — |
| Hospedagem | Vercel (Serverless + Edge) | — |
| Estilizacao | Tailwind CSS | 4.x |
| PWA | Service Worker manual | — |

---

## Multi-Tenancy

Banco unico com schema compartilhado. Isolamento logico por `tenantId` em **todas** as tabelas operacionais.

```
Tenant (1)
  ├── User (N)
  ├── Cliente (N)
  ├── DSF (N)
  │     └── InsumoDSF (N)
  ├── DriveCredential (0-1)
  ├── Assinatura (0-1)
  ├── ProcedimentoConfig (N)
  └── AuditLog (N)

Plano (N) ──► Assinatura (N)
GatewayConfig — configuracao global (sem tenant)
PagamentoLog (N) ──► Assinatura
```

Toda query de escrita/leitura passa pela verificacao `where: { tenantId: session.user.tenantId }` no nivel da API Route — nunca delegado ao frontend. Tenants "internos" (com usuario `SUPER_ADMIN_GLOBAIS`) sao filtrados automaticamente nas listagens administrativas.

---

## PBAC — Permission-Based Access Control

Em vez de roles fixas, cada usuario tem um array de permissoes explicitamente concedidas.

### Permissoes Disponiveis

| Permissao | Descricao |
|---|---|
| `CLIENTE_BUSCAR` | Buscar pacientes por CPF no balcao |
| `CLIENTE_CADASTRAR` | Registrar novos pacientes |
| `DSF_EMITIR` | Emitir DSF |
| `DSF_CANCELAR` | Cancelar DSFs emitidas |
| `ANVISA_RELATORIOS` | Historico para fiscalizacao + assinar DSF como RT |
| `DRIVE_CONFIGURAR` | Conectar Google Drive e configurar procedimentos |
| `SUPER_ADMIN_GLOBAIS` | Gestao global de tenants, planos, gateways |

### Perfis Tipicos

| Perfil | Permissoes |
|---|---|
| Atendente de balcao | `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR` |
| Responsavel Tecnico (farmaceutico) | + `ANVISA_RELATORIOS` |
| Gerente / Admin | + `DSF_CANCELAR`, `DRIVE_CONFIGURAR` |
| Super Admin SaaS | Todas |

### JWT — Re-fetch no banco a cada request

O callback `jwt` no NextAuth re-busca nome, email, permissoes e CRF do banco em toda renovacao de token. Isso garante que alteracoes feitas pelo admin reflitam imediatamente sem logout.

```typescript
async jwt({ token, user }) {
  if (user) { /* login: popula do objeto user */ }
  else if (token.id) {
    const dbUser = await prisma.user.findUnique({ where: { id: token.id } })
    if (dbUser?.ativo) {
      token.name = dbUser.nome
      token.permissions = dbUser.permissions
      // ...
    }
  }
  return token
}
```

---

## Sistema de Assinaturas

Cada tenant tem uma `Assinatura` ligada a um `Plano`. O ciclo de vida e controlado por status e data de expiracao.

```
Plano (TRIAL / MENSAL / ANUAL / VITALICIO)
  └── Assinatura por tenant
        ├── Status: TRIAL → ATIVA → SUSPENSA / CANCELADA / EXPIRADA
        ├── gatewayCustomerId  (Stripe customer_id)
        ├── gatewaySubscriptionId (Stripe subscription_id)
        └── PagamentoLog (historico de cobrancas)
```

### Controle de Acesso por Assinatura

O layout do dashboard (`src/app/dashboard/layout.tsx`) verifica o status da assinatura a cada requisicao de pagina. Se `EXPIRADA` ou `CANCELADA`, redireciona para `/dashboard/assinatura-expirada`. Super Admin nao e afetado.

### Cron de Expiracao

`GET /api/cron/expirar-assinaturas` (diario as 04:00 UTC) marca como `EXPIRADA` toda assinatura TRIAL ou ATIVA com `expiraEm` no passado.

---

## Integracao Stripe

```
Super Admin configura chaves em /dashboard/gateways
  → GatewayConfig.secretKeyEncrypted (AES-256-GCM)
  → GatewayConfig.webhookSecretEncrypted (AES-256-GCM)

POST /api/stripe/checkout
  → Cria/reusa Stripe Customer para o tenant
  → Cria Price no Stripe (salva ID no Plano para reuso)
  → Retorna URL da Checkout Session

POST /api/webhooks/stripe
  → Verifica assinatura com stripe.webhooks.constructEvent()
  → Atualiza status da Assinatura e registra PagamentoLog
```

Gateways suportados (estrutura extensivel): Stripe, Asaas, MercadoPago.

---

## Google Drive por Tenant

```
Admin autoriza OAuth → DriveCredential salvo (tokens AES-256-GCM)
Cada DSF → upload automatico para pasta do tenant
```

**Seguranca dos tokens:**
```
Formato: base64( iv[12] | tag[16] | ciphertext )
Algoritmo: AES-256-GCM
Chave: DRIVE_TOKEN_ENCRYPTION_KEY (64 hex = 32 bytes)
```

A mesma funcao `encrypt/decrypt` de `src/lib/crypto.ts` e reutilizada para credenciais de gateways de pagamento.

---

## PWA

Service worker manual em `public/sw.js` (compativel com Turbopack):
- Network-first para paginas (sempre frescos)
- Cache-first para assets estaticos
- Registro via `src/components/pwa-register.tsx` (client component)
- `public/manifest.json` com 8 tamanhos de icone (72px a 512px)

---

## Fluxo de Emissao de DSF

```
Atendente busca CPF → GET /api/clients/search
                              │
              ┌───────────────┴───────────┐
              ▼                           ▼
           viewing                    not_found
              │                           │
         Iniciar DSF              Cadastrar → POST /api/clients/register
              │
         POST /api/dsf/create
              │ (status EMITIDA)
         dsf_generated
              │
         [Imprimir / Digitalizar foto do cupom assinado]
              │
         POST /api/dsf/upload-signed
              │ (foto → PDF → Drive)
         status CONCLUIDA
```

Layout da impressao determinado por `Tenant.tipoImpressao`:
- `BOBINA_80MM` — cupom termico 72mm
- `FOLHA_A4` — relatorio clinico A4

---

## Proxy (Roteamento)

`src/proxy.ts` (equivalente ao middleware do Next.js ≤15) verifica autenticacao para rotas `/dashboard/**`. O controle de assinatura (status) e feito no Server Component do layout — nao no proxy — para evitar acesso ao banco no Edge runtime.

---

## Auditoria (AuditLog)

Todas as acoes criticas sao registradas com IP real e User-Agent. Ver `DATABASE.md` para lista completa de `AuditAcao`.

---

## Restricao Critica — NeonHttp

O adaptador `PrismaNeonHttp` nao suporta transacoes interativas.

**Nunca usar:**
- `prisma.$transaction()`
- `prisma.model.createMany()`
- `prisma.model.updateMany()` dentro de transaction
- `prisma.model.upsert()` — usa transacao internamente

**Sempre usar:**
- `Promise.all` de operacoes individuais para writes paralelos
- `const existing = await findUnique(); existing ? update() : create()` para upsert manual

---

## Estrutura de Diretorios

```
src/
  proxy.ts                  Verificacao de autenticacao (Edge)
  app/
    api/
      auth/[...nextauth]/   NextAuth handler
      clients/              Busca, cadastro e edicao de pacientes
      dsf/                  Emissao, upload, listagem, cancelamento
      admin/
        planos/             CRUD de planos de assinatura
        assinaturas/        Gestao de assinaturas por tenant
        gateways/           Configuracao de gateways de pagamento
        procedimentos/      Config de procedimentos por tenant
        tenants/            CRUD de tenants
        users/              CRUD de usuarios
        dashboard/          Metricas SaaS (assinaturas, receita)
        clients/            Listagem admin de clientes
      stripe/
        checkout/           Gera Stripe Checkout Session
      webhooks/[gateway]/   Recebe notificacoes Stripe/Asaas/MercadoPago
      procedimentos/        Procedimentos ativos do tenant (uso client)
      integrations/
        google-drive/       OAuth redirect, callback, status, disconnect
      cron/
        cleanup-dsf/        Cancela DSFs EMITIDA > 24h
        expirar-assinaturas/ Marca assinaturas expiradas
    auth/login/             Pagina de login
    dashboard/
      layout.tsx            Shell + verificacao de assinatura (Server)
      page.tsx              Home adaptativa
      clientes/             Balcao de atendimento (maquina de estados)
      anvisa/               Relatorio DSF — historico, filtros, CSV
      pacientes/            Listagem admin de clientes
      admin/
        page.tsx            Gestao de usuarios (tenant admin)
        procedimentos/      Configurar procedimentos habilitados + textos
      tenants/              Painel Global SaaS
      planos/               Gestao de planos de assinatura
      gateways/             Configuracao de meios de pagamento
      saas/                 Dashboard administrativo SaaS (metricas)
      assinatura-expirada/  Tela de bloqueio por assinatura expirada
      configuracoes/        Integracao Google Drive
  components/
    dashboard-shell.tsx     Layout responsivo + badge de assinatura
    pwa-register.tsx        Registro do service worker (client)
    nav-link.tsx            Link ativo com usePathname
    logout-button.tsx       Botao de logout client-side
  lib/
    auth.ts                 NextAuth (PBAC + re-fetch do banco no JWT)
    prisma.ts               Singleton PrismaClient (NeonHttp)
    stripe.ts               Inicializa Stripe com chave do banco
    tipo-servico.ts         Labels dos TipoServico (client-safe)
    crypto.ts               AES-256-GCM encrypt/decrypt
    drive.ts                Upload Drive com refresh de token
  types/
    next-auth.d.ts          Augmentacao de tipos NextAuth
  generated/prisma/         Cliente Prisma gerado (npx prisma generate)
prisma/
  schema.prisma             Schema completo
  seed.ts                   Seed de desenvolvimento
  migrations/               Historico SQL
public/
  manifest.json             PWA manifest
  sw.js                     Service worker
  icon-*.png                Icones PWA (72px–512px)
docs/                       Esta documentacao
vercel.json                 Crons, deploy config
```
