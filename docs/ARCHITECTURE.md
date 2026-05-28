# Arquitetura — DSF System

## Visao Geral

SaaS multi-tenant para drogarias emitirem, armazenarem e auditarem **Declaracoes de Servicos Farmaceuticos (DSF)** em conformidade com ANVISA RDC 44/2009 e LGPD (Lei 13.709/2018).

---

## Stack Tecnologica

| Camada | Tecnologia | Versao |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 |
| Linguagem | TypeScript (strict) | 5.x |
| Runtime | React | 19.2.4 |
| ORM | Prisma | 7.8.0 |
| Banco | Neon PostgreSQL (serverless) | — |
| Adapter DB | `@prisma/adapter-neon` (HTTP) | 7.8.0 |
| Autenticacao | NextAuth.js v4 + JWT | 4.24.x |
| Geracao PDF | pdf-lib (server-side) | 1.17.x |
| Armazenamento | Google Drive API v3 (por tenant) | googleapis 172 |
| Hospedagem | Vercel (Edge/Serverless) | — |
| Estilizacao | Tailwind CSS | 4.x |

---

## Multi-Tenancy

Banco unico com schema compartilhado. Isolamento logico por `tenantId` em **todas** as tabelas operacionais.

```
Tenant
  └── User (N)
  └── Cliente (N)
  └── DSF (N)
  └── DriveCredential (1:1)
  └── AuditLog (N)
```

Toda query de escrita/leitura passa pela verificacao `where: { tenantId: session.user.tenantId }` no nivel da API Route — nunca delegado ao frontend.

---

## PBAC — Permission-Based Access Control

Em vez de roles fixas, cada usuario tem um array de permissoes explicitamente concedidas.

### Permissoes Disponiveis

| Permissao | Descricao |
|---|---|
| `CLIENTE_BUSCAR` | Buscar pacientes por CPF no balcao |
| `CLIENTE_CADASTRAR` | Registrar novos pacientes |
| `DSF_EMITIR` | Emitir DSF e gerar PDF |
| `DSF_CANCELAR` | Cancelar DSFs emitidas |
| `ANVISA_RELATORIOS` | Acesso ao historico para fiscalizacao + assinar DSF como RT |
| `DRIVE_CONFIGURAR` | Conectar/desconectar Google Drive do tenant |
| `SUPER_ADMIN_GLOBAIS` | Gestao global de tenants e usuarios |

### Perfis Tipicos (combinacoes)

| Perfil | Permissoes |
|---|---|
| Atendente de balcao | `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR` |
| Responsavel Tecnico (farmaceutico) | + `ANVISA_RELATORIOS` |
| Gerente / Admin | + `DSF_CANCELAR`, `DRIVE_CONFIGURAR` |
| Super Admin SaaS | Todas |

### Como Funciona no JWT

```typescript
// Armazenado no token JWT (NextAuth)
token.permissions = user.permissions  // Permission[]
token.tenantId    = user.tenantId
token.crf         = user.crf          // farmaceutico

// Acessivel em qualquer API Route
const session = await getServerSession(authOptions)
const perms = session.user.permissions as string[]
if (!perms.includes('DSF_EMITIR')) return 403
```

---

## Fluxo de Emissao de DSF

```
Atendente busca CPF
    │
    ├─ Encontrado ──► ViewCard (confirmar dados)
    │                     │
    │                     ├─ Editar dados ──► PUT /api/clients/update
    │                     │
    │                     └─ Iniciar DSF ──► EmitCard
    │                                            │
    │                                            └─ POST /api/dsf/create
    │                                                    │
    │                                                    ├─ Gera PDF (pdf-lib, server-side)
    │                                                    ├─ Upload Google Drive (se configurado)
    │                                                    └─ Salva no banco (sempre)
    │
    └─ Nao encontrado ──► NotFoundCard
                              │
                              └─ Cadastrar ──► RegisterCard
                                                    │
                                                    └─ POST /api/clients/register
                                                            │
                                                            └─ Vai para ViewCard
```

### Logica do Responsavel Tecnico (RT)

O RT assina a DSF. A API resolve assim:

1. Se o operador tem `ANVISA_RELATORIOS` → ele mesmo e o RT
2. Se nao → busca o primeiro usuario ativo do tenant com `ANVISA_RELATORIOS`
3. Se nao existe nenhum RT → retorna `422 Unprocessable Entity`

---

## Geracao de PDF (pdf-lib, server-side)

O PDF e gerado **no servidor** (nao no browser) para garantir consistencia da assinatura e do layout.

- Fonte: `StandardFonts.Helvetica` (WinAnsiEncoding — cobre todo o portugues)
- Formato: A4, margem 48pt
- Secoes: Cabecalho azul, dados da drogaria + RT, dados do paciente, tipo de servico, tabela de insumos (zebra), observacoes (word-wrap), assinatura RT, rodape legal ANVISA
- Rodape legal: *"Este procedimento constitui monitoramento/triagem e NAO substitui o diagnostico medico. Conforme ANVISA RDC 44/2009."*

---

## Google Drive por Tenant

Cada tenant armazena os PDFs no seu proprio Google Drive, eliminando custos de storage centralizado e facilitando compliance.

```
Admin autoriza OAuth → DriveCredential salvo no banco (tokens criptografados AES-256-GCM)
Cada DSF emitida → upload automatico para a pasta configurada
```

### Seguranca dos Tokens

```
Formato em disco: base64( iv[12] | tag[16] | ciphertext )
Algoritmo: AES-256-GCM
Chave: DRIVE_TOKEN_ENCRYPTION_KEY (64 hex chars = 32 bytes)
```

O token e renovado automaticamente (`refreshAccessToken`) antes de cada upload se estiver expirado.

---

## Numeracao Sequencial de DSFs

Formato: `DSF-{ANO}-{SEQUENCIAL:5 digitos}` por tenant.

```typescript
const count = await prisma.dSF.count({ where: { tenantId, createdAt: { gte: startOfYear } } })
const numeroDsf = `DSF-2026-${String(count + 1).padStart(5, '0')}`
// Ex: DSF-2026-00001
```

Protecao contra race condition: `@@unique([tenantId, numeroDsf])` no schema.

---

## Auditoria (AuditLog)

Todas as acoes criticas sao registradas com IP real (`x-forwarded-for`) e User-Agent.

| Acao | Disparada por |
|---|---|
| `LOGIN` / `LOGOUT` | NextAuth callbacks |
| `CLIENTE_CRIADO` | POST /api/clients/register |
| `CLIENTE_ATUALIZADO` | PUT /api/clients/update |
| `DSF_CRIADA` | POST /api/dsf/create |
| `DSF_CONCLUIDA` | Quando driveFileId e salvo |
| `DSF_CANCELADA` | POST /api/dsf/cancel (futuro) |
| `DRIVE_AUTORIZADO` / `DRIVE_REVOGADO` | OAuth callback Drive (futuro) |
| `CRON_CLEANUP_DSF` | Cron job automatico |

---

## Cron Job — Limpeza de DSFs

Rota: `GET /api/cron/cleanup-dsf`  
Autenticacao: Header `Authorization: Bearer $CRON_SECRET`  
Finalidade: Marca como `CANCELADA` DSFs que ficaram `EM_ANDAMENTO` por mais de 24h (falha silenciosa no upload do Drive).

Configurado no `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/cleanup-dsf", "schedule": "0 3 * * *" }] }
```

---

## Estrutura de Diretorios

```
src/
  app/
    api/
      auth/[...nextauth]/    NextAuth handler
      clients/
        search/              GET  — busca por CPF
        register/            POST — cadastrar novo cliente
        update/              PUT  — atualizar dados
      dsf/
        create/              POST — emitir DSF
      cron/
        cleanup-dsf/         GET  — job noturno
    auth/
      login/                 Pagina de login
    dashboard/
      layout.tsx             Shell com sidebar (Server Component)
      page.tsx               Home adaptativa (admin vs atendente)
      clientes/              Balcao de atendimento (maquina de estados)
      anvisa/                Historico e relatorios (futuro)
      drive/                 Configuracao Google Drive (futuro)
      admin/                 Painel administrativo (futuro)
  components/
    dashboard-shell.tsx      Layout responsivo (drawer mobile / sidebar desktop)
    nav-link.tsx             Link ativo com usePathname
    logout-button.tsx        Botao de logout client-side
    cpf-search.tsx           Widget de busca rapida (home)
  lib/
    auth.ts                  Configuracao NextAuth (PBAC callbacks)
    prisma.ts                Singleton PrismaClient (NeonHttp)
    tipo-servico.ts          Labels dos TipoServico (client-safe, sem Prisma)
    pdf-dsf.ts               Geracao de PDF A4 (server-only)
    drive.ts                 Upload para Google Drive com refresh de token
    crypto.ts                AES-256-GCM encrypt/decrypt
  types/
    next-auth.d.ts           Augmentacao de tipos NextAuth
  generated/
    prisma/                  Cliente Prisma gerado (npx prisma generate)
prisma/
  schema.prisma              Schema completo
  seed.ts                    Seed de desenvolvimento (2 tenants, 4 usuarios)
  migrations/                Historico de migrations SQL
docs/                        Esta documentacao
```
