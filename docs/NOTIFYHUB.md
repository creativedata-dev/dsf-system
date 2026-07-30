# NotifyHub — Planejamento do Projeto

Data: 2026-07-30  
Status: **Decisões arquiteturais tomadas — pronto para iniciar**

---

## Por que criar

Dois projetos (Loja Atibaia, PlaceGo CRM) implementaram mensageria de formas diferentes e ambos chegaram ao mesmo conjunto de limitações:
- Sem retry / fila robusta — falhas silenciosas
- Sem ACK tracking completo
- Providers mockados ou incompletos
- Config espalhada entre env vars e banco
- Não reaproveitável entre projetos

A FarmaSign (e projetos futuros) vai precisar de mensageria para DSF digital, agendamentos, lembretes de validade, alertas de equipamentos. Faz sentido extrair isso para um serviço próprio, instalável em qualquer projeto.

---

## O que é

**NotifyHub** — serviço/pacote TypeScript de mensageria multi-canal, auto-hospedado ou como serviço SaaS leve.

Canais planejados:
- WhatsApp (Evolution API / Meta Cloud API)
- E-mail (Resend / SMTP custom)
- Web Push (VAPID — já implementado no FarmaSign)
- SMS (Twilio / Vonage)
- In-app (webhook para o projeto consumidor)

Modelo de uso:
```typescript
// Em qualquer projeto Next.js / Node
import { notify } from '@notifyhub/client'

await notify({
  to: { phone: '5511999999999', email: 'user@email.com' },
  channel: ['whatsapp', 'email'],        // fallback em ordem
  template: 'dsf_link_assinatura',
  data: { nome: 'João', link: 'https://...' },
  tenantId: 'tenant-abc',
})
```

---

## Referências e lições dos projetos anteriores

| Decisão | Loja Atibaia | PlaceGo CRM | NotifyHub |
|---------|-------------|-------------|-----------|
| Adapter pattern | Sim (incompleto) | Não (wrappers diretos) | Sim (completo) |
| Multi-tenant | Não | Sim | Sim |
| Config | Banco (singleton) | Env + banco | Banco por tenant |
| ACK tracking | Não | Parcial (Evolution) | Completo |
| Retry | Não | Não | Sim (com backoff) |
| Fila | Não | Não | Sim |
| Media | Não | Parcial | Sim |
| Providers WA | 3 (todos mock) | 2 (funcionais) | Evolution + Meta (funcionais) |

---

## Arquitetura proposta

### ✅ Decisão: Híbrido (pacote + painel hosted)

- **Pacote NPM `@notifyhub/core`** instalado em cada projeto — envio direto, sem latência de rede, dados não saem do projeto
- **Painel web hosted** (`notifyhub.seudominio.com`) — dashboard centralizado para templates, logs e config de todos os projetos/workspaces num lugar só
- Cada projeto autentica no painel via API key de workspace

---

## Stack

### ✅ Decisão: Monorepo (Turborepo)

Um repositório `notifyhub/` com workspaces separados. Versões em sincronia, types compartilhados, releases coordenados.

```
notifyhub/                          (monorepo Turborepo)
  packages/
    core/                           -- adapters, queue, lógica de envio
    client/                         -- SDK TypeScript para instalar nos projetos
    types/                          -- tipos compartilhados
  apps/
    dashboard/                      -- Next.js — painel de templates, logs, config
    api/                            -- Hono — REST API (sync de logs e templates)

Banco:        PostgreSQL (Neon serverless)
Queue:        pg-boss — fila sobre PostgreSQL, zero Redis para começar
ORM:          Prisma
E-mail:       Resend
WhatsApp:     Evolution API + Meta Cloud API
SMS:          Twilio
Push:         web-push VAPID
```

**pg-boss:** usa o próprio PostgreSQL como fila — zero infra adicional. Se o volume escalar, migra para BullMQ + Redis sem mudar a interface pública.

---

## Schema do banco (core)

```prisma
model Workspace {
  id        String  @id @default(uuid())
  nome      String
  apiKey    String  @unique @default(uuid())
  ativo     Boolean @default(true)
  createdAt DateTime @default(now())

  configs   ChannelConfig[]
  templates Template[]
  logs      MessageLog[]
}

model ChannelConfig {
  id          String  @id @default(uuid())
  workspaceId String
  canal       Canal   -- enum: WHATSAPP_EVOLUTION | WHATSAPP_META | EMAIL_RESEND | EMAIL_SMTP | SMS_TWILIO | PUSH_VAPID
  config      Json    -- credenciais criptografadas específicas do canal
  ativo       Boolean @default(true)

  workspace Workspace @relation(...)
  @@unique([workspaceId, canal])
}

model Template {
  id          String  @id @default(uuid())
  workspaceId String
  slug        String  -- ex: "dsf_link_assinatura"
  canal       Canal
  assunto     String? -- e-mail
  corpo       String  -- texto com {{variáveis}} Handlebars/Mustache
  ativo       Boolean @default(true)
  createdAt   DateTime @default(now())

  workspace Workspace @relation(...)
  @@unique([workspaceId, slug, canal])
}

model MessageLog {
  id          String   @id @default(uuid())
  workspaceId String
  canal       Canal
  template    String?
  destino     String   -- phone ou email (mascarado nos logs)
  status      Status   -- PENDENTE | ENVIADO | ENTREGUE | LIDO | ERRO | IGNORADO
  ack         Int?     -- 0-3 para WhatsApp
  tentativas  Int      @default(0)
  erro        String?
  metadata    Json?    -- dados extras (messageId do provider, etc.)
  createdAt   DateTime @default(now())
  enviadoEm   DateTime?
  entreguEm   DateTime?
  lidoEm      DateTime?

  workspace Workspace @relation(...)
  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([workspaceId, canal, status])
}

model QueueJob {
  id          String   @id @default(uuid())
  workspaceId String
  canal       Canal
  payload     Json
  status      String   -- PENDENTE | PROCESSANDO | CONCLUIDO | FALHOU
  tentativas  Int      @default(0)
  proximaTent DateTime?
  erro        String?
  createdAt   DateTime @default(now())
  @@index([status, proximaTent])
}
```

---

## Interface pública (SDK)

```typescript
// Envio simples
await notify({
  workspaceId: 'ws-abc',
  to: { phone: '5511999999999' },
  channel: 'whatsapp',
  template: 'dsf_link_assinatura',
  data: { nome: 'João', link: 'https://...' },
})

// Com fallback automático: tenta WhatsApp, cai para e-mail se falhar
await notify({
  workspaceId: 'ws-abc',
  to: { phone: '5511999999999', email: 'joao@email.com' },
  channel: ['whatsapp', 'email'],
  template: 'lembrete_agendamento',
  data: { nome: 'João', data: '15/08', hora: '14h' },
})

// Envio imediato vs fila
await notify({ ..., queue: false })  // síncrono (padrão: queue: true)

// Webhook de status (ACK)
// NotifyHub chama POST no projeto consumidor quando status muda
```

---

## Adapters — interface interna

```typescript
interface ChannelAdapter {
  send(payload: SendPayload): Promise<SendResult>
  validateConfig(config: Json): Promise<boolean>
  parseWebhook?(body: unknown): WebhookEvent | null
}

// Implementações:
class EvolutionAdapter implements ChannelAdapter { ... }
class MetaCloudAdapter implements ChannelAdapter { ... }
class ResendAdapter implements ChannelAdapter { ... }
class TwilioAdapter implements ChannelAdapter { ... }
class VapidPushAdapter implements ChannelAdapter { ... }
```

---

## Features do dashboard

- **Templates:** editor com preview, variáveis Handlebars, teste de envio
- **Logs:** tabela com filtros por canal/status/período, detalhe do erro
- **Config:** configurar credenciais por canal (criptografadas no banco)
- **Webhooks:** configurar URL de callback de ACK por workspace
- **Analytics:** taxa de entrega, erros por provider, volume por dia

---

## Evolution API — hospedagem

### ✅ Decisão: Centralizado com escala horizontal

- **Você hospeda um servidor Evolution** (Railway ou VPS) — custo fixo único
- Cada workspace/projeto tem sua própria **instância** dentro desse servidor (= número de WhatsApp isolado)
- Sem interferência entre projetos — cada farmácia, cada cliente usa seu número próprio
- `ChannelConfig` armazena `evolutionServerUrl` por workspace → quando o volume crescer, basta apontar para um segundo servidor sem mudar a interface

```
Servidor Evolution A (Railway)
  ├── instância: farmasign-farmacia-abc    → número (11) 99999-0001
  ├── instância: farmasign-farmacia-xyz    → número (21) 98888-0002
  └── instância: placego-cliente-123       → número (11) 97777-0003

(quando crescer)
Servidor Evolution B (Railway)
  ├── instância: novoprojeto-workspace-1
  └── ...
```

---

## Ordem de implementação

1. Monorepo Turborepo — estrutura de pastas, tsconfig base, build pipeline
2. `packages/types` — interfaces compartilhadas (`ChannelAdapter`, `SendPayload`, `MessageLog`)
3. `packages/core` — adapters Evolution + Resend funcionais, queue pg-boss, schema Prisma
4. `packages/client` — SDK leve (`notify()`) que consome o core
5. Integrar no **FarmaSign** (DSF digital) como primeiro consumidor real — valida a DX
6. `apps/api` — Hono REST API com auth por API key (sync de logs para o painel)
7. `apps/dashboard` — Next.js, templates, logs, config por workspace
8. Adapters adicionais: Meta Cloud, Twilio SMS, VAPID Push
9. Fallback automático entre canais (ex: WhatsApp falha → cai para e-mail)
10. Publicar `@notifyhub/client` no npm ou GitHub Packages

---

## Decisões tomadas

| # | Decisão | Escolha |
|---|---------|---------|
| Q1 | Modelo de uso | Híbrido: pacote NPM + painel hosted |
| Q2 | Estrutura do código | Monorepo (Turborepo) |
| Q3 | Evolution API | Centralizado com escala horizontal (instâncias por workspace, servidores adicionados conforme demanda) |
| Q4 | Nome | NotifyHub |
