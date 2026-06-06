# Fluxos — FarmaSign

## 1. Maquina de Estados — Emissao DSF

Arquivo: `src/app/dashboard/clientes/page.tsx`

### Estados (Mode)

```
idle              Tela inicial, campo de busca CPF
searching         Aguardando GET /api/clients/search
not_found         CPF nao cadastrado
registering       Formulario de novo paciente
registering_saving Aguardando POST /api/clients/register
viewing           Ficha do paciente + historico de DSFs
editing           Formulario de edicao de dados
saving            Aguardando PUT /api/clients/update
emitting          Formulario de emissao de DSF
submitting_dsf    Aguardando POST /api/dsf/create
dsf_generated     Documento gerado — aguarda impressao e assinatura
dsf_scanning      Captura do cupom assinado (camera ou drag & drop)
dsf_uploading     Aguardando POST /api/dsf/upload-signed
dsf_concluida     Tela de conclusao apos upload bem-sucedido
```

### Diagrama de Transicoes

```
idle
  │─ submit CPF ──► searching
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
      not_found      viewing        idle (erro)
          │             │
    ┌─────┤         ┌───┴──────────────────────┐
    ▼     ▼         ▼                          ▼
regist. idle     editing                    emitting
    │               │                          │
    ▼           ┌───┴──┐                 submitting_dsf
reg_saving    saving  viewing                  │
    │             │                      dsf_generated
    ▼             ▼                            │
 viewing        viewing              ┌─────────┴─────────┐
                               window.print()       dsf_scanning
                               (impressao)               │
                                                ┌────────┴────────┐
                                                ▼                 ▼
                                          dsf_uploading         viewing
                                                │               (cancel)
                                        ┌───────┴──────┐
                                        ▼              ▼
                                   dsf_concluida  dsf_scanning
                                        │          (erro, retry)
                               ┌────────┴────────┐
                               ▼                 ▼
                            viewing            idle
```

---

## 2. Fluxo de Busca e Atendimento

```
Atendente digita CPF → GET /api/clients/search?cpf={digits}
                              │
              ┌───────────────┼────────────────────┐
              │ 200           │ 404                │ Erro
              ▼               ▼                    ▼
           viewing         not_found             idle
    + fetch /api/clients/{id}/dsfs (paralelo)
    + fetch /api/procedimentos (paralelo, ao abrir formulario de emissao)
```

O widget `CpfSearch` no home redireciona para `/dashboard/clientes?cpf={digits}`.

---

## 3. Fluxo de Emissao de DSF

### Etapa 1 — Emissao

```
viewing → [Iniciar DSF] → emitting

Formulario:
  - Tipo de servico (apenas procedimentos ativos do tenant)
  - Evolucao farmaceutica (observacoes)
  - Insumos (lote, fabricante, validade)

[Emitir DSF] → POST /api/dsf/create
                       │
             ┌─────────┴─────────┐
             │ 200               │ 422 (sem RT)
             ▼                   ▼
        dsf_generated         dsfError

  Retorno inclui textoOrientacao configurado para o procedimento.
```

Layout determinado por `Tenant.tipoImpressao`:
- `BOBINA_80MM` — cupom termico 72mm `@page { size: 80mm auto }`
- `FOLHA_A4` — relatorio clinico A4

### Etapa 2 — Digitalizacao

```
dsf_generated → [Digitalizar] → dsf_scanning

Captura:
  - Mobile (pointer: coarse): camera traseira
  - Desktop: drag & drop ou selecao de arquivo (JPG, PNG, PDF)

[Enviar] → POST /api/dsf/upload-signed
                    │
          ┌─────────┴──────────┐
          │ 200                │ Erro
          ▼                    ▼
     dsf_concluida        dsf_scanning (retry)
```

Upload-signed: imagem → PDF (pdf-lib) → Drive → DSF.status = CONCLUIDA.

---

## 4. Fluxo de Procedimentos por Tenant

```
Admin → /dashboard/admin/procedimentos

Toggle ativo/inativo por TipoServico
Texto de orientacao livre por procedimento

PUT /api/admin/procedimentos → salva ProcedimentoConfig

Na emissao DSF:
  GET /api/procedimentos → retorna apenas procedimentos ativos
  Select mostra somente esses servicos
  Texto de orientacao aparece impresso abaixo do servico
```

Se nenhuma config salva: todos os 11 servicos aparecem por padrao.

---

## 5. Fluxo de Assinaturas (Super Admin)

### Criar assinatura manualmente

```
/dashboard/tenants → [Detalhes] → aba Assinatura

Formulario: plano, status, data de expiracao, gateway, IDs

[Criar Assinatura] → POST /api/admin/assinaturas
                              │
                     NeonHttp: find + create/update manual
                              │
                     Assinatura criada/atualizada
```

### Gerar link de pagamento Stripe

```
aba Assinatura → [💳 Mensal / 📅 Anual / ♾️ Vitalicio]

POST /api/stripe/checkout { tenantId, planoId, cadencia }
                                  │
                     Stripe API: customer + price + session
                                  │
                     { url } → window.open(url)
                                  │
                     Tenant paga no Stripe Checkout
                                  │
                     POST /api/webhooks/stripe (evento checkout.session.completed)
                                  │
                     Assinatura.status = ATIVA
                     PagamentoLog APROVADO
                     AuditLog ASSINATURA_ATUALIZADA + PAGAMENTO_REGISTRADO
```

### Expiracao automatica

```
Todo dia 04:00 UTC:
GET /api/cron/expirar-assinaturas
    │
    └─ Assinaturas TRIAL/ATIVA com expiraEm < agora
    └─ status = EXPIRADA (Promise.all individual, sem transaction)
    └─ AuditLog ASSINATURA_EXPIRADA
```

### Controle de acesso

```
dashboard/layout.tsx (Server Component):
  ├─ isSuperAdmin? → sem restricao
  └─ busca Assinatura do tenant
      ├─ status EXPIRADA ou CANCELADA → redirect /dashboard/assinatura-expirada
      └─ status TRIAL → badge amarelo na sidebar com data de expiracao
```

---

## 6. Fluxo de Configuracao de Gateway

```
/dashboard/gateways → cartoes Stripe / Asaas / MercadoPago

[Configurar] → modal com campos:
  - Secret Key (criptografada AES-256-GCM antes de salvar)
  - Webhook Secret (idem)
  - Publishable Key (plaintext)
  - Ativo / Modo teste

POST /api/admin/gateways → GatewayConfig.upsert via find+create/update

Chaves retornam mascaradas: sk_test_••••••••••••••••1234
```

### Verificacao de webhook Stripe

```
POST /api/webhooks/stripe
  1. Busca GatewayConfig.secretKeyEncrypted → decrypt → Stripe(secretKey)
  2. Busca GatewayConfig.webhookSecretEncrypted → decrypt → webhookSecret
  3. stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  4. Se valido: normaliza payload → atualiza Assinatura → registra PagamentoLog
```

---

## 7. Fluxo Google Drive

```
/dashboard/configuracoes → [Conectar]
    → GET /api/integrations/google-drive
    → Consentimento Google
    → GET /api/integrations/google-drive/callback?code=...
        ├─ Troca code por tokens
        ├─ Busca email da conta
        ├─ Cria pasta "FarmaSign — {tenantNome}" no Drive
        ├─ Salva DriveCredential (AES-256-GCM)
        └─ redirect ?drive=conectado
```

---

## 8. Fluxo de Autenticacao

```
/dashboard/** sem sessao → proxy.ts → redirect /auth/login

/auth/login → POST /api/auth/callback/credentials (NextAuth)
                    │
       ┌────────────┼────────────┐
       │ Valido     │ Invalido   │ Tenant inativo
       ▼            ▼            ▼
   JWT criado   Erro 401      Bloqueado
   redirect /dashboard

JWT (renovado a cada getServerSession):
  - Re-busca usuario no banco para refletir edicoes imediatas
  - payload: id, tenantId, permissions[], crf?
```

---

## 9. Sidebar por Perfil

### Secao Principal
| Item | Permissao |
|---|---|
| Inicio | qualquer admin |
| Emissao DSF | `CLIENTE_BUSCAR` |
| Relatorio DSF | `ANVISA_RELATORIOS` |
| Clientes | qualquer admin |

### Secao Configuracao
| Item | Permissao |
|---|---|
| Usuarios | qualquer admin |
| Google Drive | `DRIVE_CONFIGURAR` |
| Procedimentos | `DRIVE_CONFIGURAR` |
| Dashboard SaaS | `SUPER_ADMIN_GLOBAIS` |
| Pagamentos | `SUPER_ADMIN_GLOBAIS` |
| Planos | `SUPER_ADMIN_GLOBAIS` |
| Estabelecimentos | `SUPER_ADMIN_GLOBAIS` |

---

## 10. Cron Jobs

### Limpeza de DSFs (03:00 UTC)

```
GET /api/cron/cleanup-dsf
Authorization: Bearer {CRON_SECRET}
    │
    └─ DSFs EMITIDA com updatedAt < agora - 24h
    └─ status = CANCELADA
    └─ AuditLog CRON_CLEANUP_DSF
    └─ { cancelled: N }
```

### Expiracao de Assinaturas (04:00 UTC)

```
GET /api/cron/expirar-assinaturas
Authorization: Bearer {CRON_SECRET}
    │
    └─ Assinaturas TRIAL/ATIVA com expiraEm < agora
    └─ status = EXPIRADA
    └─ AuditLog ASSINATURA_EXPIRADA
    └─ { expiradas: N }
```

---

## 11. Restricao Critica — NeonHttp

O adaptador `PrismaNeonHttp` nao suporta transacoes interativas.

**Nunca usar:**
- `prisma.$transaction()`
- `prisma.model.createMany()`
- `prisma.model.updateMany()` dentro de transaction
- `prisma.model.upsert()` — usa transacao internamente

**Sempre usar:**
- `Promise.all(items.map(item => prisma.model.create({ data: item })))` para creates multiplos
- `find + create/update` manual para upsert:

```typescript
const existing = await prisma.model.findUnique({ where: { uniqueField } })
const result = existing
  ? await prisma.model.update({ where: { uniqueField }, data })
  : await prisma.model.create({ data: { uniqueField, ...data } })
```
