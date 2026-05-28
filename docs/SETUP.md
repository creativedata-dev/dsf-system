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

O projeto usa `.env` na raiz (ignorado pelo git via `.gitignore`).

### Descricao de cada variavel

| Variavel | Descricao | Como gerar |
|---|---|---|
| `DATABASE_URL` | String de conexao Neon PostgreSQL (pooled) | Dashboard Neon → Connection string |
| `NEXTAUTH_SECRET` | Segredo para assinatura JWT | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXTAUTH_URL` | URL base da aplicacao (sem barra final) | `http://localhost:3000` em dev; URL do Vercel em prod |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID | Google Cloud Console → Credenciais → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | Mesmo local acima |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | Chave AES-256-GCM (64 chars hex = 32 bytes) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Token Bearer para o cron job | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> **DRIVE_TOKEN_ENCRYPTION_KEY**: nunca altere apos um tenant conectar o Drive — os tokens cifrados no banco ficam ilegíveis.

### Exemplo completo `.env`

```env
DATABASE_URL="postgresql://user:password@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="base64-32bytes-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth2
GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"

# AES-256-GCM para cifrar tokens do Drive
DRIVE_TOKEN_ENCRYPTION_KEY="64-hex-chars-aqui"

# Cron jobs (Vercel)
CRON_SECRET="64-hex-chars-aqui"
```

---

## 3. Banco de dados

### Aplicar migrations (primeira vez ou apos pull)

```bash
npx prisma migrate deploy
```

### Gerar o cliente Prisma

```bash
npx prisma generate
```

> Sempre rodar `prisma generate` apos `migrate deploy` — o cliente gerado fica em `src/generated/prisma/` e NAO e commitado.

### Criar uma nova migration (ao alterar schema)

```bash
npx prisma migrate dev --name descricao_da_mudanca
```

---

## 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`. A aplicacao redireciona `/` para `/auth/login`.

---

## 5. Build de producao

```bash
npm run build
npm start
```

---

## 6. Configuracao Google OAuth

### No Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie ou selecione um projeto
2. **APIs e Servicos → Biblioteca** → ative **Google Drive API**
3. **APIs e Servicos → Credenciais → Criar Credencial → ID do cliente OAuth 2.0**
   - Tipo: **Aplicativo da Web**
   - Nome: `DSF System`
4. Adicione as URIs de redirecionamento autorizadas:
   - Dev: `http://localhost:3000/api/integrations/google-drive/callback`
   - Prod: `https://seu-dominio.vercel.app/api/integrations/google-drive/callback`
5. Copie Client ID e Client Secret para `.env`

### Escopo solicitado

```
https://www.googleapis.com/auth/drive.file
```

Escopo minimo — a aplicacao so acessa arquivos que ela mesma criou.

### Fluxo OAuth na aplicacao

```
/dashboard/configuracoes → botao "Conectar"
    → GET /api/integrations/google-drive          (gera URL, redireciona)
    → Google (consentimento do usuario)
    → GET /api/integrations/google-drive/callback  (troca code por tokens)
    → cria pasta no Drive do tenant
    → salva DriveCredential cifrada no banco
    → redirect /dashboard/configuracoes?drive=conectado
```

---

## 7. Deploy no Vercel

### Variaveis de ambiente

Configure todas as variaveis do `.env` no painel Vercel:
**Settings → Environment Variables**

`NEXTAUTH_URL` deve ser a URL de producao sem barra final (ex: `https://dsf-system.vercel.app`).

### Cron job automatico

`vercel.json` configura o cron de limpeza de DSFs abandonadas:

```json
{ "crons": [{ "path": "/api/cron/cleanup-dsf", "schedule": "0 3 * * *" }] }
```

O Vercel chama esse endpoint diariamente as 03:00 UTC com o header `Authorization: Bearer {CRON_SECRET}`.

### Comandos pos-deploy (primeira vez)

```bash
npx prisma migrate deploy   # aplica migrations no banco de producao
```

---

## 8. Estrutura de diretorios chave

```
.env                        Variaveis de ambiente (nao commitado)
prisma/
  schema.prisma             Schema do banco
  migrations/               Historico de migrations SQL
src/
  generated/prisma/         Cliente Prisma gerado (nao commitado)
  lib/                      Utilitarios server-side (auth, prisma, pdf, drive, crypto)
  app/
    api/
      auth/                 NextAuth
      clients/              Busca, cadastro e edicao de pacientes
      dsf/                  Emissao (create) e digitalizacao (upload-signed)
      integrations/
        google-drive/       OAuth redirect, callback, status, disconnect
      cron/                 Limpeza automatica de DSFs abandonadas
    auth/                   Paginas publicas (login)
    dashboard/
      clientes/             Balcao de atendimento (fluxo completo)
      configuracoes/        Integracao Google Drive
      anvisa/               Historico e relatorios (futuro)
      admin/                Gestao de usuarios (futuro)
  components/               Componentes reutilizaveis
docs/                       Esta documentacao
```

---

## 9. Checklist de primeiro deploy

- [ ] `DATABASE_URL` aponta para banco Neon com SSL
- [ ] `NEXTAUTH_SECRET` gerado (base64, 32 bytes)
- [ ] `NEXTAUTH_URL` com URL de producao sem barra final
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` configurados
- [ ] URI de redirecionamento do Google inclui URL de producao
- [ ] `DRIVE_TOKEN_ENCRYPTION_KEY` com 64 caracteres hex
- [ ] `CRON_SECRET` configurado
- [ ] `npx prisma migrate deploy` executado no banco de producao
- [ ] `npx prisma generate` executado apos migrate
- [ ] Login funcional
