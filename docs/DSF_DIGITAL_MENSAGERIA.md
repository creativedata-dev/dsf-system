# DSF Digital + Camada de Mensageria — Planejamento

Data: 2026-07-30  
Status: **Em planejamento — aguardando decisões**

---

## Contexto

O fluxo atual de emissão de DSF é físico:
1. Farmacêutico emite o DSF → imprime o cupom
2. Paciente assina à mão
3. Farmacêutico fotografa o documento assinado
4. Faz upload da foto → status CONCLUÍDA

O objetivo é adicionar um **fluxo 100% digital** como alternativa, sem remover o fluxo físico atual.

---

## Decisões Pendentes ⚠️

### D1 — Provider de WhatsApp
**Opção A — Evolution API** (como no PlaceGo CRM)
- API self-hosted, multi-tenant, com ACK tracking
- Cada farmácia usa seu próprio número de WhatsApp
- Requer instância Evolution por tenant + credenciais por tenant
- Mais poderoso, mas mais infra

**Opção B — Link `wa.me` simples**
- Sem API: farmacêutico clica → WhatsApp abre com mensagem pré-pronta com o link
- Zero infra, zero custo
- Não rastreia entrega, não é automático
- Boa para MVP, limitada para futuro (agendamentos, lembretes)

> **Pergunta:** Quer começar com `wa.me` (MVP rápido) ou já implementar Evolution API estruturada?

---

### D2 — Ordem de implementação
**Opção A — Assinatura digital primeiro**
- Entrega valor imediato ao farmacêutico
- Mensageria fica simples (`wa.me`) por enquanto
- Camada de mensageria robusta vem depois

**Opção B — Mensageria primeiro**
- Cria a base reutilizável para DSF digital, agendamentos, lembretes de validade, etc.
- Leva mais tempo para o farmacêutico ver resultado

> **Pergunta:** Prefere valor rápido (A) ou fundação sólida (B)?

---

## Plano Técnico (rascunho)

### Parte 1 — Camada de Mensageria

**Referências:**
- Loja Atibaia (`D:\dev\helder-loja\loja-atibaia`): adapter pattern multi-provider (Evolution, Meta, Exxor), Nodemailer, logs em `NotificacaoLog`
- PlaceGo CRM (`D:\dev\placego-crm`): Evolution API + Resend, webhook inbound, ACK tracking, multi-tenant

**Arquitetura proposta (`src/lib/mensageria/`):**
```
src/lib/mensageria/
  index.ts              -- enviarMensagem({ tenantId, canal, evento, destino, payload })
  providers/
    email.ts            -- Resend (SaaS, sem infra)
    whatsapp.ts         -- Evolution API ou wa.me dependendo da D1
```

**Schema — novas tabelas:**
```prisma
model ConfigMensageria {
  id              String  @id @default(uuid())
  tenantId        String  @unique
  evolutionUrl    String? -- URL da instância Evolution (por tenant)
  evolutionApiKey String? -- criptografada com AES-256-GCM
  evolutionInst   String? -- nome da instância
  resendApiKey    String? -- opcional, override do global
  emailRemetente  String?
  ativo           Boolean @default(true)
  tenant          Tenant  @relation(...)
}

model MensagemLog {
  id         String   @id @default(uuid())
  tenantId   String
  canal      String   -- "WHATSAPP" | "EMAIL" | "SMS"
  evento     String   -- "DSF_LINK_ASSINATURA" | "DSF_CONCLUIDA" | ...
  destino    String   -- número ou email
  status     String   -- "ENVIADO" | "ERRO" | "PENDENTE"
  erro       String?
  dsfId      String?
  createdAt  DateTime @default(now())
}
```

**Eventos planejados (extensível):**
| Evento | Canal | Trigger |
|--------|-------|---------|
| `DSF_LINK_ASSINATURA` | WhatsApp/SMS | Farmacêutico clica "Enviar link" |
| `DSF_CONCLUIDA` | WhatsApp | Assinatura digital confirmada |
| `AGENDAMENTO_LEMBRETE` | WhatsApp | Cron D-1 (futuro) |
| `VALIDADE_ALERTA` | WhatsApp/Email | Cron diário (futuro) |
| `EQUIPAMENTO_VENCENDO` | Email | Cron diário (futuro) |

---

### Parte 2 — DSF Digital

#### Fluxo pós-emissão (3 opções na tela de atendimento)

```
[ Assinar no celular agora ]   → QR Code na tela (cliente aponta o cel)
[ Enviar link por WhatsApp ]   → dispara mensagem / abre wa.me
[ Fluxo físico ]               → comportamento atual (sem mudança)
```

#### Schema — campos novos em `DSF`

```prisma
-- Adicionar ao model DSF:
linkToken        String?   @unique  -- UUID do link público
linkExpiresAt    DateTime?          -- emissão + 48h
assinadoEm       DateTime?
assinaturaImg    String?            -- base64 da assinatura canvas
assinaturaIp     String?
assinaturaUa     String?
assinaturaHash   String?            -- SHA-256(conteúdo + assinaturaImg)
modoAssinatura   String?            -- "DIGITAL" | "FISICO"
```

#### Rota pública `/assinar/[token]`

- Sem autenticação (acesso pelo link/QR)
- Exibe: dados do DSF, insumos, texto de orientação, dados da farmácia
- Canvas de assinatura com o dedo (mobile) ou mouse (desktop)
- Ao confirmar: salva assinatura → gera PDF → upload no Drive → CONCLUÍDA
- Token inválido/expirado/já assinado → tela de erro amigável

#### Comprobatório jurídico

O PDF gerado inclui:
- Conteúdo completo do DSF
- Imagem da assinatura canvas
- Timestamp (ISO 8601 + timezone)
- IP e User-Agent do signatário
- Hash SHA-256 do conteúdo + assinatura (integridade verificável)

> Equivalente probatório ao processo físico fotográfico — ambos são provas documentais,
> não requerem ICP-Brasil para validade como registro de serviço farmacêutico.

---

### Ordem de implementação (quando aprovada)

1. **Migration manual** — campos `linkToken`, `linkExpiresAt`, etc. em `DSF` + tabelas `ConfigMensageria` e `MensagemLog`
2. **Camada mensageria** — `src/lib/mensageria/` com provider escolhido em D1
3. **Rota pública** — `/assinar/[token]` + UI do cliente (canvas, revisar DSF, confirmar)
4. **Integração atendimento** — 3 opções pós-emissão na tela de atendimento
5. **Config mensageria** — tela em `/dashboard/configuracoes` para o tenant configurar seu WhatsApp

---

## Notas de Contexto

- **Fluxo físico não muda** — continua funcionando exatamente como hoje
- **Upload no Drive** — o PDF da assinatura digital segue o mesmo caminho do `upload-signed` atual
- **Multi-tenant** — cada farmácia pode ter seu próprio número WhatsApp (via Evolution) ou usar `wa.me` sem config
- **NeonHttp** — sem `$transaction()`, sem `createMany()` — seguir padrões já estabelecidos no projeto
- **Prisma CLI quebrado localmente** — migration aplicada via script Node direto no Neon
