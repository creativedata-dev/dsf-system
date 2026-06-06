# Configuracao do Ambiente — FarmaSign

## Prerequisitos

| Ferramenta | Versao minima |
|---|---|
| Node.js | 20.x LTS |
| npm | 10.x |
| PostgreSQL | Neon serverless (neon.tech) |
| Google Cloud | Projeto OAuth para Drive |
| Stripe | Conta em stripe.com (opcional) |

---

## 1. Clonar e instalar

```bash
git clone https://github.com/synapseiqadm/dsf-system.git
cd dsf-system
npm install
```

---

## 2. Variaveis de ambiente

Arquivo `.env` na raiz (ignorado pelo git).

### Descricao

| Variavel | Descricao | Como gerar |
|---|---|---|
| `DATABASE_URL` | String de conexao Neon (pooled) | Dashboard Neon → Connection string |
| `NEXTAUTH_SECRET` | Segredo para assinatura JWT | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXTAUTH_URL` | URL base da aplicacao | `http://localhost:3000` em dev |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID | Google Cloud Console → Credenciais |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | Idem |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | Chave AES-256-GCM (64 chars hex) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Token Bearer para cron jobs | Mesmo comando acima |

> **DRIVE_TOKEN_ENCRYPTION_KEY**: a mesma chave e usada para criptografar credenciais do Google Drive e dos gateways de pagamento. **Nunca altere apos dados serem gravados no banco** — os registros criptografados ficarao ilegíveis.

### Exemplo `.env`

```env
DATABASE_URL="postgresql://user:password@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require"

NEXTAUTH_SECRET="base64-32bytes-aqui"
NEXTAUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"

DRIVE_TOKEN_ENCRYPTION_KEY="64-hex-chars-aqui"

CRON_SECRET="64-hex-chars-aqui"
```

---

## 3. Banco de dados

```bash
# Aplicar todas as migrations no banco
npx prisma migrate deploy

# Gerar o cliente Prisma
npx prisma generate

# Criar dados de teste (desenvolvimento)
npx tsx prisma/seed.ts
```

> Sempre rodar `prisma generate` apos `migrate deploy`. O cliente gerado fica em `src/generated/prisma/` e NAO e commitado.

---

## 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`. Redireciona automaticamente para `/auth/login`.

---

## 5. Build de producao

```bash
npm run build
npm start
```

---

## 6. Configuracao Google OAuth

### No Google Cloud Console

1. **APIs e Servicos → Biblioteca** → ative **Google Drive API**
2. **Credenciais → Criar → ID do cliente OAuth 2.0**
   - Tipo: **Aplicativo da Web**
3. Adicione URIs de redirecionamento autorizadas:
   - Dev: `http://localhost:3000/api/integrations/google-drive/callback`
   - Prod: `https://app.farmasign.com.br/api/integrations/google-drive/callback`
4. Copie Client ID e Secret para `.env`

### Escopos
```
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.email
```

---

## 7. Configuracao Stripe (opcional)

As chaves Stripe sao armazenadas criptografadas no banco — **nao precisam de variavel de ambiente**.

### Passos apos o deploy

1. Acesse `https://app.farmasign.com.br/dashboard/gateways` como Super Admin
2. Clique em **Configurar** na linha Stripe
3. Insira:
   - **Secret Key**: `sk_test_...` (teste) ou `sk_live_...` (producao)
   - **Publishable Key**: `pk_test_...` ou `pk_live_...`
   - **Webhook Secret**: `whsec_...` (do Stripe Dashboard → Webhooks)
4. Marque como **Ativo** e salve

### Configurar webhook no Stripe Dashboard

URL para registrar: `https://app.farmasign.com.br/api/webhooks/stripe`

Eventos a escutar:
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `charge.refunded`

---

## 8. Deploy no Vercel

### Variaveis de ambiente

Configure no painel Vercel: **Settings → Environment Variables**

| Variavel | Observacao |
|---|---|
| `DATABASE_URL` | |
| `NEXTAUTH_SECRET` | |
| `NEXTAUTH_URL` | URL de producao sem barra final |
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | Mesma chave usada no banco |
| `CRON_SECRET` | |

> **Stripe**: chaves ficam no banco (criptografadas), nao em variaveis de ambiente.

### Cron jobs (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/cleanup-dsf",          "schedule": "0 3 * * *" },
    { "path": "/api/cron/expirar-assinaturas",   "schedule": "0 4 * * *" }
  ]
}
```

O Vercel chama esses endpoints diariamente com `Authorization: Bearer {CRON_SECRET}`.

### Deploy automatico

O GitHub Actions (`.github/workflows/deploy.yml`) faz deploy a cada push para `master`:
```yaml
vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
```

O Vercel nao faz deploy automatico pelo GitHub — desabilitado via `"github": { "enabled": false }` no `vercel.json` para evitar builds duplicados.

---

## 9. Checklist de primeiro deploy

- [ ] `DATABASE_URL` aponta para banco Neon com SSL
- [ ] `NEXTAUTH_SECRET` gerado (base64, 32 bytes)
- [ ] `NEXTAUTH_URL` = URL de producao sem barra final
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` configurados
- [ ] URI de redirecionamento Google inclui URL de producao
- [ ] `DRIVE_TOKEN_ENCRYPTION_KEY` = 64 chars hex
- [ ] `CRON_SECRET` configurado
- [ ] `npx prisma migrate deploy` executado no banco
- [ ] `npx tsx prisma/seed.ts` executado (cria planos e usuarios iniciais)
- [ ] Login funcional em `/auth/login`
- [ ] Stripe configurado em `/dashboard/gateways` (opcional)
