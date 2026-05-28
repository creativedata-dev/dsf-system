# Prompt de Retomada — DSF System

Cole este bloco no inicio da proxima sessao com o Claude:

---

Estamos desenvolvendo o **DSF System**, SaaS multi-tenant para drogarias emitirem e arquivarem a Declaracao de Servico Farmaceutico (DSF) conforme ANVISA RDC 44/2009.

## Stack

- Next.js App Router (versao atual — ler `node_modules/next/dist/docs/` antes de usar APIs novas)
- Prisma 7.8.0 + PrismaNeonHttp (PostgreSQL Neon serverless)
- NextAuth JWT — payload: `id`, `tenantId`, `permissions[]`, `crf`
- Tailwind CSS inline, sem componentes externos
- `googleapis` (Drive OAuth2), `pdf-lib` (foto/PDF → upload), `bcryptjs`

## Restricao critica — NeonHttp

Nunca usar `$transaction`, `createMany` ou `updateMany`. Sempre `Promise.all` de operacoes individuais.

## O que esta implementado e funcionando

### Autenticacao e RBAC
- Login email/senha, JWT, 7 permissoes: `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR`, `DSF_CANCELAR`, `ANVISA_RELATORIOS`, `DRIVE_CONFIGURAR`, `SUPER_ADMIN_GLOBAIS`
- `DashboardShell` com sidebar adaptada por permissao e duas secoes: Principal e Configuracao

### Emissao DSF (`/dashboard/clientes`)
- Busca por CPF + historico de DSFs do paciente exibido em tempo real (GET /api/clients/{id}/dsfs)
- Cadastro com LGPD + ViaCEP, edicao de dados
- Emissao: 11 tipos de servico, evolucao farmaceutica, insumos opcionais
- Impressao dinamica: BOBINA_80MM (cupom 80mm) ou FOLHA_A4 (relatorio clinico)
- Logo do tenant no documento (fallback nome em negrito)
- Captura adaptavel: camera (mobile) ou drag & drop (desktop)
- Aceita foto (JPEG/PNG) ou PDF direto — converte imagem para PDF se necessario
- Foto/PDF → Drive → DSF EMITIDA → CONCLUIDA → tela de conclusao (modo dsf_concluida)

### Relatorio DSF (`/dashboard/anvisa`)
- Listagem paginada (20/pag), filtros: data, status, tipo de servico
- Exportacao CSV com BOM UTF-8 (acentos corretos no Excel)
- Botao "Ver PDF" via driveFileId
- Cancelamento com motivo + AuditLog
- Requer `ANVISA_RELATORIOS`

### Clientes — listagem admin (`/dashboard/pacientes`)
- Busca por nome ou CPF, paginacao (25/pag)
- Filtro por tenant (Super Admin)
- Modal com duas abas: Dados (editavel) e Historico DSF (com link para PDF no Drive)
- PATCH /api/admin/clients/{id} admin-scoped (Super Admin edita qualquer tenant)

### Gestao de Usuarios (`/dashboard/admin`)
- Super Admin: vê todos os tenants com filtro; tenant admin: so seu tenant
- Criar, editar, ativar/desativar usuarios
- Permissoes via checkboxes; tenant admin nao pode conceder SUPER_ADMIN_GLOBAIS
- AuditLog USUARIO_CRIADO / USUARIO_ATUALIZADO

### Painel Global SaaS (`/dashboard/tenants`)
- Lista todos os tenants com _count de usuarios e DSFs
- Modal de detalhe com duas abas:
  - Dados: editar nome, CNPJ, endereco, logo (upload com resize canvas), tipoImpressao, ativo
  - Usuarios: listar, criar, editar, ativar/desativar usuarios do tenant
- Logo: max 320x160px, WebP 0.85, salvo como base64 em Tenant.logoUrl
- AuditLog TENANT_CRIADO / TENANT_ATUALIZADO

### Integracao Google Drive (`/dashboard/configuracoes`)
- OAuth2 completo: redirect → callback → cria pasta → tokens AES-256-GCM no banco
- Escopos: drive.file + userinfo.email
- Email da conta Google salvo em DriveCredential.driveEmail, exibido no dashboard
- Renovacao automatica de access token no upload
- Card Conectado/Desconectado, Reconectar, Remover Integracao

### Dashboard home (`/dashboard`)
- Cards com dados reais: DSFs hoje, total clientes, status Drive + email da conta Google
- Painel Administrativo para admins; tela de busca simples para atendentes

### Logo do Tenant no Sidebar
- Quando tenant tem logo: exibe a imagem no header da sidebar no lugar de "DSF System"
- Quando nao tem logo: icone azul + "DSF System" + nome do tenant

## Rotas de API

```
# Balcao
GET  /api/clients/search
POST /api/clients/register
PUT  /api/clients/update
GET  /api/clients/[id]/dsfs

# DSF
POST /api/dsf/create
POST /api/dsf/upload-signed    (foto/PDF → Drive → CONCLUIDA)
GET  /api/dsf/list             (paginado, filtros, format=csv)
POST /api/dsf/cancel

# Admin — Clientes
GET   /api/admin/clients
GET   /api/admin/clients/[id]
PATCH /api/admin/clients/[id]

# Admin — Usuarios
GET   /api/admin/users         (?tenantId= para super admin)
POST  /api/admin/users
PATCH /api/admin/users/[id]

# Admin — Tenants
GET   /api/admin/tenants
POST  /api/admin/tenants
PATCH /api/admin/tenants/[id]

# Drive
GET  /api/integrations/google-drive
GET  /api/integrations/google-drive/callback
GET  /api/integrations/google-drive/status
POST /api/integrations/google-drive/disconnect

# Cron
GET  /api/cron/cleanup-dsf    (cancela DSFs EMITIDA > 24h)
```

## Banco (Neon — todas migrations aplicadas)

Modelos: `Tenant` (logoUrl, tipoImpressao), `User`, `Cliente`, `DSF`, `InsumoDSF`, `DriveCredential` (driveEmail), `AuditLog`

Migrations:
- `add_drive_email` — campo driveEmail em DriveCredential
- `add_tenant_audit_actions` — TENANT_CRIADO e TENANT_ATUALIZADO no enum AuditAcao

## Proximo passo sugerido

**Deploy Vercel:**
- Configurar env vars no painel Vercel (Settings → Environment Variables)
- Adicionar URI de producao no Google Cloud Console
- `npx prisma migrate deploy` no banco de producao
- `NEXTAUTH_URL` com URL de producao sem barra final

## Arquivos-chave

```
src/app/dashboard/clientes/page.tsx        — emissao DSF (fluxo completo ~1300 linhas)
src/app/dashboard/anvisa/anvisa-client.tsx — relatorio DSF
src/app/dashboard/pacientes/               — listagem admin de clientes
src/app/dashboard/admin/                   — gestao de usuarios
src/app/dashboard/tenants/                 — painel global SaaS
src/app/api/dsf/                           — emissao, upload, listagem, cancelamento
src/app/api/admin/                         — clientes, usuarios, tenants
src/components/dashboard-shell.tsx         — sidebar adaptativa com logo
prisma/schema.prisma
docs/API.md                               — referencia completa de API
docs/FLOWS.md                             — maquina de estados e fluxos
docs/SETUP.md                             — env vars e deploy
```

## Repositorio

- Branch: `master` | Remoto: `https://github.com/synapseiqadm/dsf-system.git`
- `.env` local configurado com todas as variaveis (nao commitado)
- Migrations aplicadas, cliente Prisma gerado
