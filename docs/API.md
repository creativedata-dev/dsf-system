# Referencia de API — FarmaSign

Todas as rotas exigem sessao autenticada via NextAuth (cookie `next-auth.session-token`).
Respostas de erro: `{ "error": "mensagem" }`.

---

## Autenticacao

### `POST /api/auth/callback/credentials`
Login com email e senha. Gerenciado pelo NextAuth.

**Body:** `{ email, password }`

**JWT retornado inclui:** `id`, `name`, `email`, `tenantId`, `permissions[]`, `crf?`

---

## Clientes (balcao)

### `GET /api/clients/search?cpf={digits}`
Busca cliente por CPF no tenant da sessao.
**Permissao:** qualquer usuario autenticado
**Respostas:** `200` cliente | `404` nao encontrado

### `POST /api/clients/register`
Cadastra novo paciente.
**Permissao:** `CLIENTE_CADASTRAR`
**Body:** `nome`, `cpf`, `dataNascimento`, `sexo`, `telefone`, `endereco`, `email?`, `rg?`
**Respostas:** `201` | `409` CPF duplicado

### `PUT /api/clients/update`
Atualiza dados do paciente.
**Permissao:** `CLIENTE_BUSCAR`
**Body:** `id`, campos a alterar

### `GET /api/clients/{id}/dsfs`
Historico de DSFs de um paciente.
**Permissao:** qualquer usuario autenticado

---

## DSF

### `POST /api/dsf/create`
Emite uma nova DSF (status `EMITIDA`).
**Permissao:** `DSF_EMITIR`
**Body:** `clienteId`, `tipoServico`, `observacoes?`, `insumos[]`
**Retorna:** payload completo para impressao, incluindo `textoOrientacao` do procedimento configurado

### `POST /api/dsf/upload-signed`
Recebe foto/PDF do cupom assinado, converte para PDF, faz upload no Drive, atualiza status para `CONCLUIDA`.
**Permissao:** `DSF_EMITIR`
**Body:** `dsfId`, `fileBase64` (data URL de imagem ou PDF)

### `GET /api/dsf/list`
Lista DSFs paginadas com filtros.
**Permissao:** `ANVISA_RELATORIOS`
**Query:** `page?`, `status?`, `tipoServico?`, `dataInicio?`, `dataFim?`, `format=csv`

### `POST /api/dsf/cancel`
Cancela uma DSF.
**Permissao:** `DSF_CANCELAR`
**Body:** `dsfId`, `motivo?`

---

## Procedimentos

### `GET /api/procedimentos`
Retorna procedimentos ativos do tenant da sessao (para o select de emissao).
**Permissao:** qualquer usuario autenticado

### `GET /api/admin/procedimentos?tenantId?`
Lista todos os 11 procedimentos com config do tenant (ativo + textoOrientacao).
**Permissao:** `DRIVE_CONFIGURAR` ou `SUPER_ADMIN_GLOBAIS`

### `PUT /api/admin/procedimentos`
Salva configuracoes de procedimentos.
**Body:** `{ procedimentos: [{ tipoServico, ativo, textoOrientacao }] }`, `tenantId?` (Super Admin)

---

## Admin — Clientes

### `GET /api/admin/clients`
Lista clientes com paginacao.
**Permissao:** qualquer admin | `SUPER_ADMIN_GLOBAIS` pode filtrar por `tenantId`

### `GET /api/admin/clients/{id}`
Detalhe de um cliente.

### `PATCH /api/admin/clients/{id}`
Atualiza dados do cliente.

---

## Admin — Usuarios

### `GET /api/admin/users`
Lista usuarios. Super Admin pode passar `?tenantId=`.
**Permissao:** qualquer admin

### `POST /api/admin/users`
Cria usuario no tenant.
**Permissao:** `DRIVE_CONFIGURAR` ou `SUPER_ADMIN_GLOBAIS`

### `PATCH /api/admin/users/{id}`
Edita usuario (nome, email, senha, permissoes, CRF, ativo).

---

## Admin — Tenants

### `GET /api/admin/tenants`
Lista tenants (exclui tenants internos com SUPER_ADMIN_GLOBAIS).
**Permissao:** `SUPER_ADMIN_GLOBAIS`

### `POST /api/admin/tenants`
Cria novo tenant.

### `PATCH /api/admin/tenants/{id}`
Edita tenant (dados, logo, tipoImpressao, ativo).

---

## Admin — Planos

### `GET /api/admin/planos`
Lista todos os planos com contagem de assinaturas.
**Permissao:** `SUPER_ADMIN_GLOBAIS`

### `POST /api/admin/planos`
Cria plano.
**Body:** `nome`, `tipo` (TRIAL/MENSAL/ANUAL/VITALICIO), `precoMensal?`, `precoAnual?`, `limiteUsuarios?`, `limiteDsfsMes?`, `trialDias?`, `ativo?`

### `PATCH /api/admin/planos`
Atualiza plano.
**Body:** `id`, campos a alterar

---

## Admin — Assinaturas

### `GET /api/admin/assinaturas?tenantId={id}`
Retorna assinatura do tenant com historico de pagamentos.
**Permissao:** `SUPER_ADMIN_GLOBAIS`

### `POST /api/admin/assinaturas`
Cria assinatura para um tenant.
**Body:** `tenantId`, `planoId`, `status`, `expiraEm?`, `gateway?`, `gatewayCustomerId?`, `gatewaySubscriptionId?`, `obs?`
**Nota:** `expiraEm` e calculado automaticamente para TRIAL/MENSAL/ANUAL se nao informado

### `PATCH /api/admin/assinaturas/{id}`
Atualiza assinatura (status, plano, expiracao, gateway).

---

## Admin — Gateways

### `GET /api/admin/gateways`
Lista Stripe, Asaas e MercadoPago com status de configuracao. Chaves aparecem mascaradas.
**Permissao:** `SUPER_ADMIN_GLOBAIS`

### `POST /api/admin/gateways`
Salva/atualiza configuracao de um gateway.
**Body:** `gateway`, `secretKey?` (novo valor), `webhookSecret?`, `publicKey?`, `ativo?`, `modoTeste?`
**Nota:** Campos de chave em branco mantem o valor existente no banco.

---

## Admin — Dashboard SaaS

### `GET /api/admin/dashboard`
Retorna metricas consolidadas de assinaturas e receita.
**Permissao:** `SUPER_ADMIN_GLOBAIS`

**Retorna:**
```json
{
  "assinaturas": { "ativas": 0, "trial": 0, "suspensas": 0, "canceladas": 0, "expiradas": 0, "total": 0 },
  "receita": { "mesAtual": 0, "mesAnterior": 0 },
  "novos": { "mesAtual": 0, "mesAnterior": 0 },
  "totalTenants": 0,
  "distribuicaoPlanos": [{ "nome": "", "tipo": "", "total": 0 }],
  "ultimasPagamentos": [{ "valor": 0, "gateway": "", "tenant": "", "createdAt": "" }],
  "historico6Meses": [{ "mes": "2026-06", "total": 0 }]
}
```

---

## Stripe

### `POST /api/stripe/checkout`
Gera Stripe Checkout Session para um tenant assinar um plano.
**Permissao:** `SUPER_ADMIN_GLOBAIS`
**Body:** `tenantId`, `planoId`, `cadencia?` (`mensal` | `anual` | `unico`)
**Retorna:** `{ url, sessionId }` — abrir `url` para o tenant finalizar o pagamento

**Comportamento:**
- Cria/reusa Stripe Customer para o tenant
- Cria Stripe Price dinamicamente se nao existir (salva ID no Plano para reuso)
- Mode `subscription` para mensal/anual, `payment` para vitalicio

---

## Webhooks

### `POST /api/webhooks/{gateway}`
Recebe notificacoes de pagamento. Gateways suportados: `stripe`, `asaas`.

**Stripe:** verifica assinatura com `stripe.webhooks.constructEvent()` usando secret do banco.
**Asaas:** verifica token no header `asaas-access-token`.

**Eventos Stripe tratados:**
| Evento | Acao |
|---|---|
| `checkout.session.completed` | Assinatura → ATIVA, atualiza `planoId` do metadata, registra pagamento APROVADO |
| `invoice.payment_succeeded` | Assinatura → ATIVA, atualiza `planoId` (subscription_details.metadata) e `expiraEm` (period_end da fatura), registra pagamento APROVADO |
| `invoice.payment_failed` | Assinatura → SUSPENSA, registra pagamento RECUSADO |
| `customer.subscription.deleted` | Assinatura → CANCELADA |
| `charge.refunded` | Registra pagamento REEMBOLSADO |

**Lookup da assinatura (ordem de prioridade):**
1. `metadata.tenantId` (disponivel no checkout.session.completed)
2. `gatewaySubscriptionId`
3. `gatewayCustomerId`

---

## Integracoes Google Drive

### `GET /api/integrations/google-drive`
Inicia fluxo OAuth (redireciona para Google).

### `GET /api/integrations/google-drive/callback`
Recebe code OAuth, troca por tokens, cria pasta no Drive, salva `DriveCredential`.

### `GET /api/integrations/google-drive/status`
Retorna status da conexao Drive do tenant.

### `POST /api/integrations/google-drive/disconnect`
Revoga tokens e remove `DriveCredential`.

---

## Cron Jobs

### `GET /api/cron/cleanup-dsf`
Cancela DSFs com status `EMITIDA` ha mais de 24h (abandono).
**Auth:** `Authorization: Bearer {CRON_SECRET}`
**Schedule:** 03:00 UTC diario

### `GET /api/cron/expirar-assinaturas`
Marca como `EXPIRADA` toda assinatura TRIAL/ATIVA com `expiraEm` no passado.
**Auth:** `Authorization: Bearer {CRON_SECRET}`
**Schedule:** 04:00 UTC diario

### `GET /api/cron/alertas-temperatura`
Verifica ambientes sem leitura MANHA ou TARDE no dia anterior, registra `AuditLog` por omissao.
**Schedule:** 08:00 UTC diario

### `GET /api/cron/alertas-equipamentos`
Recalcula status de todos os equipamentos ativos (exceto MANUTENCAO) com base em `dataProximaCalibracao`.
Atualiza para `ATIVO`, `VENCENDO` (≤30 dias) ou `VENCIDO`.
**Schedule:** 08:00 UTC diario

---

## Temperatura e Umidade

### `GET /api/ambientes`
Lista ambientes ativos do tenant.
**Permissao:** qualquer usuario autenticado

### `POST /api/ambientes`
Cadastra ambiente.
**Permissao:** `TEMPERATURA_GERENCIAR`
**Body:** `nome`, `tipo` (GELADEIRA|AMBIENTE|SALA_ESPECIAL), `tempMin`, `tempMax`, `umidadeMin?`, `umidadeMax?`

### `PATCH /api/ambientes/{id}`
Edita ou desativa ambiente.
**Permissao:** `TEMPERATURA_GERENCIAR`

### `POST /api/temperatura`
Registra leitura de temperatura.
**Permissao:** qualquer usuario autenticado
**Body:** `ambienteId`, `dataLeitura`, `periodo` (MANHA|TARDE), `temperaturaGraus`, `umidadePercent?`, `observacao?`
**Retorna:** `{ id, alertaDisparado, ... }` — `alertaDisparado: true` se temperatura fora dos limites do ambiente
**Conflito:** `409` se ja existe leitura para esse ambiente+data+periodo

### `GET /api/temperatura/historico`
Historico de leituras com filtros.
**Query:** `ambienteId?`, `dataInicio`, `dataFim`
**Retorna:** registros enriquecidos com `nomeUsuario` e `fotoUrl`

### `GET /api/temperatura/export`
Gera PDF de historico para vistoria (pdf-lib, server-side).
**Query:** mesmos filtros do historico
**Content-Type:** `application/pdf`

### `POST /api/temperatura/foto`
Faz upload de foto de uma leitura para o Google Drive.
**Body:** `multipart/form-data` — `registroId`, `foto` (JPEG/PNG/WebP/HEIC, max 10 MB)
**Nota:** Drive precisa estar configurado para o tenant

---

## Equipamentos e Calibracao

### `GET /api/equipamentos`
Lista equipamentos ativos do tenant, ordenados por `dataProximaCalibracao` ascendente.
**Permissao:** qualquer usuario autenticado

### `POST /api/equipamentos`
Cadastra equipamento.
**Permissao:** `EQUIPAMENTOS_GERENCIAR`
**Body:** `nome`, `marcaModelo`, `dataUltimaCalibracao`, `dataProximaCalibracao`, `numeroSerie?`, `numeroCertificado?`, `laboratorio?`, `obs?`
**Nota:** `status` e calculado automaticamente com base em `dataProximaCalibracao`

### `PATCH /api/equipamentos/{id}`
Edita equipamento ou altera status manualmente (para MANUTENCAO).
**Permissao:** `EQUIPAMENTOS_GERENCIAR`
**Nota:** se `dataProximaCalibracao` e alterada e `status != MANUTENCAO`, status e recalculado automaticamente

### `POST /api/equipamentos/{id}/laudo`
Upload do certificado de calibracao (PDF) para o Google Drive.
**Permissao:** `EQUIPAMENTOS_GERENCIAR`
**Body:** `multipart/form-data` — `laudo` (PDF, max 20 MB)
**Nota:** substitui o laudo anterior no banco (arquivo antigo permanece no Drive)

### `POST /api/equipamentos/{id}/foto`
Upload da foto do equipamento/lacre de calibracao para o Google Drive.
**Permissao:** `EQUIPAMENTOS_GERENCIAR`
**Body:** `multipart/form-data` — `foto` (JPEG/PNG/WebP/HEIC, max 10 MB)
