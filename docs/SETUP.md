# Configuracao do Ambiente — DSF System

## Prerequisitos

| Ferramenta | Versao minima | Notas |
|---|---|---|
| Node.js | 20.x LTS | Runtime e toolchain |
| npm | 10.x | Gerenciador de pacotes |
| PostgreSQL | Neon serverless | Conta em neon.tech |
| Google Cloud | — | Projeto OAuth para Drive |

---

## 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd dsf-system
npm install
```

---

## 2. Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha todos os campos:

```bash
cp .env.example .env.local
```

### Descricao de cada variavel

| Variavel | Descricao | Como obter |
|---|---|---|
| `DATABASE_URL` | String de conexao Neon PostgreSQL | Dashboard Neon → Connection string (modo pooled recomendado) |
| `NEXTAUTH_SECRET` | Segredo para assinatura JWT | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXTAUTH_URL` | URL base da aplicacao | `http://localhost:3000` em dev; URL do Vercel em prod |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID do Google | Google Cloud Console → Credenciais → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | Mesmo local acima |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | Chave AES-256-GCM (64 chars hex = 32 bytes) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Token Bearer para o cron job | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Exemplo completo `.env.local`

```env
DATABASE_URL="postgresql://user:password@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="64-hex-chars-aqui"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"
DRIVE_TOKEN_ENCRYPTION_KEY="64-hex-chars-aqui"
CRON_SECRET="64-hex-chars-aqui"
```

---

## 3. Banco de dados

### Criar schema (primeira vez)

```bash
npx prisma migrate deploy
```

### Gerar o cliente Prisma

```bash
npx prisma generate
```

### Popular com dados de desenvolvimento

```bash
npx prisma db seed
```

Isso cria 2 tenants e 4 usuarios de teste. Veja `docs/DATABASE.md` secao Seed para credenciais.

### Criar uma nova migration (ao alterar schema)

```bash
npx prisma migrate dev --name descricao_da_mudanca
```

---

## 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: `http://localhost:3000`

A aplicacao redireciona `/` para `/auth/login`. Apos login, vai para `/dashboard`.

---

## 5. Build de producao

```bash
npm run build
npm start
```

---

## 6. Configuracao Google OAuth

### No Google Cloud Console

1. Criar projeto no [Google Cloud Console](https://console.cloud.google.com/)
2. Ativar as APIs:
   - Google Drive API
3. Criar credenciais OAuth 2.0 (tipo: Web application)
4. Adicionar URIs de redirecionamento autorizados:
   - Dev: `http://localhost:3000/api/auth/drive/callback`
   - Prod: `https://seu-dominio.vercel.app/api/auth/drive/callback`
5. Copiar Client ID e Client Secret para `.env.local`

### Escopos necessarios

```
https://www.googleapis.com/auth/drive.file
```

Escopo minimo — acesso apenas a arquivos criados pela propria aplicacao.

---

## 7. Deploy no Vercel

### Variaveis de ambiente no Vercel

Configure todas as variaveis de `Variaveis de ambiente` acima no painel Vercel em:
Settings → Environment Variables

`NEXTAUTH_URL` deve ser a URL de producao (ex: `https://dsf-system.vercel.app`).

### Cron job automatico

O arquivo `vercel.json` ja configura o cron:

```json
{ "crons": [{ "path": "/api/cron/cleanup-dsf", "schedule": "0 3 * * *" }] }
```

O Vercel injeta `CRON_SECRET` automaticamente para autenticar a chamada. Configure o mesmo valor no painel de variaveis.

### Comandos pos-deploy (primeira vez)

```bash
npx prisma migrate deploy     # aplica migrations no banco de producao
npx prisma db seed            # opcional — apenas para ambiente de staging
```

---

## 8. Estrutura de diretorios chave

```
.env.local          Variaveis de ambiente (nao commitar)
.env.example        Template de variaveis (commitar)
prisma/
  schema.prisma     Schema do banco
  seed.ts           Seed de desenvolvimento
  migrations/       Historico de migrations SQL
src/
  generated/prisma/ Cliente Prisma gerado (npx prisma generate)
  lib/              Utilitarios server-side (auth, prisma, pdf, drive, crypto)
  app/api/          API Routes
  app/dashboard/    Paginas autenticadas
  app/auth/         Paginas publicas (login)
  components/       Componentes reutilizaveis
docs/               Esta documentacao
```

---

## 9. Checklist de primeiro deploy

- [ ] `DATABASE_URL` aponta para banco Neon com SSL
- [ ] `NEXTAUTH_SECRET` gerado e configurado
- [ ] `NEXTAUTH_URL` com URL de producao sem barra final
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` configurados
- [ ] `DRIVE_TOKEN_ENCRYPTION_KEY` com 64 caracteres hex
- [ ] `CRON_SECRET` configurado no Vercel
- [ ] Redirect URI do Google OAuth inclui URL de producao
- [ ] `npx prisma migrate deploy` executado no banco de producao
- [ ] Login funcional com usuario seed ou usuario criado manualmente
