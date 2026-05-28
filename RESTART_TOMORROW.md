# Prompt de Retomada — DSF System

Cole este bloco no inicio da proxima sessao com o Claude:

---

Estamos desenvolvendo o **DSF System**, SaaS multi-tenant para drogarias emitirem e arquivarem a Declaracao de Servico Farmaceutico (DSF) conforme ANVISA RDC 44/2009. O fluxo hibrido de emissao esta funcionando em producao local, integracao Google Drive via OAuth2 validada.

## Stack

- Next.js App Router (versao atual — ler `node_modules/next/dist/docs/` antes de usar APIs novas)
- Prisma 7.8.0 + PrismaNeonHttp (PostgreSQL Neon serverless)
- NextAuth JWT — payload: `id`, `tenantId`, `permissions[]`, `crf`
- Tailwind CSS inline, sem componentes externos
- `googleapis` (Drive OAuth2), `pdf-lib` (foto → PDF), `bcryptjs`

## Restricao critica — NeonHttp

Nunca usar `$transaction`, `createMany` ou `updateMany`. Sempre `Promise.all` de operacoes individuais.

## O que esta implementado e funcionando

### Autenticacao e RBAC
- Login email/senha, JWT, 7 permissoes: `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR`, `DSF_CANCELAR`, `ANVISA_RELATORIOS`, `DRIVE_CONFIGURAR`, `SUPER_ADMIN_GLOBAIS`
- `DashboardShell` exibe sidebar adaptada por permissao

### Balcao de Atendimento (`/dashboard/clientes`)
- Busca por CPF, cadastro com LGPD + ViaCEP, edicao de dados
- Emissao de DSF: tipo de servico (11 opcoes), evolucao farmaceutica, insumos opcionais
- Impressao dinamica: `BOBINA_80MM` (cupom 80mm) ou `FOLHA_A4` (relatorio clinico)
- Logo do tenant no documento (fallback para nome em negrito)
- Captura adaptavel: camera com viewfinder (mobile) ou drag & drop (desktop)
- Foto → PDF via pdf-lib → upload para Drive → DSF `EMITIDA` → `CONCLUIDA`

### Integracao Google Drive (`/dashboard/configuracoes`)
- OAuth2 completo: redirect → callback → cria pasta → tokens AES-256-GCM no banco
- Renovacao automatica de access token no upload
- Card Conectado/Desconectado, Reconectar, Remover Integracao

### Rotas de API
```
GET  /api/clients/search
POST /api/clients/register
PUT  /api/clients/update
POST /api/dsf/create              (status EMITIDA, retorna payload para impressao)
POST /api/dsf/upload-signed       (foto → PDF → Drive → CONCLUIDA)
GET  /api/integrations/google-drive
GET  /api/integrations/google-drive/callback
GET  /api/integrations/google-drive/status
POST /api/integrations/google-drive/disconnect
GET  /api/cron/cleanup-dsf        (cancela DSFs EMITIDA > 24h)
```

### Banco (Neon — todas migrations aplicadas)
Modelos: `Tenant` (com `logoUrl`, `tipoImpressao`), `User`, `Cliente`, `DSF`, `InsumoDSF`, `DriveCredential`, `AuditLog`

## Proximos modulos a implementar

### 1. Historico e Fiscalizacao ANVISA (`/dashboard/anvisa`)
- Listagem paginada das DSFs do tenant
- Filtros: intervalo de datas, status, tipo de servico
- Botao "Ver PDF" usando `driveFileId`
- Exportacao CSV
- Requer permissao `ANVISA_RELATORIOS`

### 2. Cancelamento de DSF
- Endpoint `POST /api/dsf/cancel`
- Botao na tela de historico para usuarios com `DSF_CANCELAR`
- AuditLog `DSF_CANCELADA`

### 3. Gestao de Usuarios (`/dashboard/admin`)
- Listar, criar, ativar/desativar usuarios do tenant
- Campos: nome, email, senha, permissoes, CRF
- Requer `SUPER_ADMIN_GLOBAIS`

### 4. Painel Global SaaS (`/dashboard/saas`)
- Listar todos os tenants, criar novo tenant + admin
- Requer `SUPER_ADMIN_GLOBAIS`

### 5. Metricas no dashboard home
- Cards atualmente estaticos com valor "0"
- Implementar: DSFs hoje, total de clientes, status Drive

### 6. Deploy Vercel
- `vercel.json` com cron job ja existe
- Configurar env vars no painel Vercel
- Adicionar URI de producao no Google Cloud Console

## Arquivos-chave

```
src/app/dashboard/clientes/page.tsx     — balcao completo (~1200 linhas)
src/app/api/dsf/create/route.ts         — emissao
src/app/api/dsf/upload-signed/route.ts  — digitalizacao + Drive
src/app/api/integrations/google-drive/  — OAuth (4 rotas)
src/app/dashboard/configuracoes/page.tsx
src/components/dashboard-shell.tsx      — sidebar adaptativa
prisma/schema.prisma
docs/SETUP.md                           — env vars e deploy
docs/FLOWS.md                           — maquina de estados e fluxos
```

## Repositorio

- Branch: `master` | Remoto: `https://github.com/synapseiqadm/dsf-system.git`
- Ultimo commit: `3acc988` — docs atualizados
- `.env` local configurado com todas as variaveis (nao commitado)
- Migrations aplicadas, cliente Prisma gerado
