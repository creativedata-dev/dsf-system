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

### `GET /api/cron/alertas-validade`
Verifica todos os lotes ATIVO com validade ate 90 dias (inclui vencidos).
Registra `AuditLog` por tenant com contagem de lotes por horizonte (vencidos / 30d / 90d).
**Auth:** `Authorization: Bearer {CRON_SECRET}`
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

---

## POPs e E-learning

### `GET /api/pops`
Lista POPs disponiveis para o tenant: conteudo global (tenantId=null) mesclado com conteudo proprio do tenant (proprio sobrepoe global de mesmo codigo).
**Permissao:** qualquer usuario autenticado (modulo POPS habilitado)
**Retorna:** `[{ id, codigo, titulo, versao, baseLegal, minAcertos, concluido, totalQuestoes }]`
`concluido: true` se o usuario logado tem `AssinaturaPOP` com `aprovado=true` para aquele documento.

### `GET /api/pops/{id}`
Retorna detalhe completo do POP: conteudo, questoes (sem `respostaCorreta`), status de conclusao do usuario.
**Permissao:** qualquer usuario autenticado

### `POST /api/pops/{id}/concluir`
Submete respostas do quiz, calcula acertos e registra `AssinaturaPOP` com `aprovado=true` se atingiu `minAcertos`.
**Body:** `{ respostas: { questaoId: "b", ... } }`
**Retorna:** `{ aprovado, acertos, totalQuestoes, minAcertos, feedback: [{ questaoId, correto, respostaCorreta, justificativa }] }`
**Regras:** retry imediato permitido; `AssinaturaPOP` criada apenas na primeira aprovacao (com `termoAceito: false`); `POP_CONCLUIDO` so e registrado apos aceite do termo; `POP_REPROVADO` registrado em caso de reprova.

### `POST /api/pops/{id}/aceitar-termo`
Registra aceite do termo de ciencia pelo usuario apos aprovacao no quiz.
**Permissao:** usuario autenticado que tenha `AssinaturaPOP` com `aprovado=true` e `termoAceito=false` para o POP.
**Retorna:** `{ termoAceitoEm }` — timestamp do aceite.
**Efeito:** atualiza `termoAceito=true`, `termoAceitoEm=now()`, cria AuditLog `POP_CONCLUIDO`.

### `GET /api/admin/pops`
Lista todos os POPs do tenant (globais + proprios) com contagem de usuarios que concluiram.
**Permissao:** `POPS_GERENCIAR` ou `SUPER_ADMIN_GLOBAIS`

### `POST /api/admin/pops`
Cria POP customizado para o tenant (substitui global de mesmo codigo ou adiciona codigo novo).
**Permissao:** `POPS_GERENCIAR`
**Body:** `{ codigo, titulo, baseLegal?, objetivo?, conteudo, versao?, minAcertos?, questoes? }`

### `GET /api/admin/pops/{id}`
Retorna POP completo com questoes (incluindo `respostaCorreta` — visao gestora).
**Permissao:** `POPS_GERENCIAR` ou `SUPER_ADMIN_GLOBAIS`

### `PATCH /api/admin/pops/{id}`
Atualiza POP: campos textuais + substituicao completa das questoes.
**Permissao:** `POPS_GERENCIAR` ou `SUPER_ADMIN_GLOBAIS`
**Nota NeonHttp:** questoes sao deletadas e recriadas via `Promise.all` (nao via `createMany` ou transacao).

### `GET /api/admin/pops/{id}/usuarios`
Lista todos os usuarios ativos do tenant com status de conclusao para um POP especifico.
**Permissao:** `POPS_GERENCIAR` ou `SUPER_ADMIN_GLOBAIS`
**Retorna:** `[{ id, nome, email, concluido, acertos?, concluidoEm? }]`
**Filtro:** `AssinaturaPOP` com `aprovado=true` (independe de `termoAceito` para compatibilidade com registros anteriores).

### `GET /api/admin/pops/equipe`
Retorna todos os dados necessarios para a aba Equipe do gestor em uma unica chamada.
**Permissao:** `POPS_GERENCIAR` ou `SUPER_ADMIN_GLOBAIS`
**Retorna:** `{ usuarios: [...], pops: [...], concluidos: string[] }` onde `concluidos` e um array de chaves `"usuarioId:documentoId"` para todos os pares aprovados.

---

## Controle de Validade e Quarentena

### `GET /api/validade/lotes`
Lista lotes do tenant com alerta calculado em runtime.
**Permissao:** qualquer usuario autenticado (modulo VALIDADE habilitado)
**Query:** `status?` (`ATIVO`|`QUARENTENA`|`DESCARTADO`), `horizonte?` (`VENCIDO`|`VENCENDO_30`|`VENCENDO_90`)
**Retorna:** lotes com `diffDias` e `alerta` (`VENCIDO`|`VENCENDO_30`|`VENCENDO_90`|null)

### `POST /api/validade/lotes`
Cadastra novo lote. Cria produto no catalogo automaticamente se nome nao existir (lookup-or-create).
**Permissao:** `VALIDADE_GERENCIAR`
**Body:** `nomeProduto`, `fabricante`, `lote`, `validade` (ISO date), `quantidade`, `unidade`, `localizacao?`, `obs?`

### `PATCH /api/validade/lotes/{id}`
Edita campos do lote.
**Permissao:** `VALIDADE_GERENCIAR`

### `POST /api/validade/lotes/{id}/quarentena`
Move lote de ATIVO para QUARENTENA com registro em AuditLog.
**Permissao:** `VALIDADE_GERENCIAR`
**Body:** `obs?`

### `POST /api/validade/lotes/{id}/descartar`
Registra descarte formal: muda status para DESCARTADO e cria `AutoDescarte` imutavel.
**Permissao:** `VALIDADE_GERENCIAR`
**Body:** `numeroAuto`, `motivo`, `dataDescarte`, `responsavel`, `obs?`

### `GET /api/validade/catalogo?q={termo}`
Autocomplete de produtos do catalogo do tenant. Ate 20 resultados, case-insensitive.
**Permissao:** qualquer usuario autenticado
**Retorna:** `[{ id, nome, fabricante, unidadePadrao }]`

---

## Rastreabilidade de Fracionamento

### `GET /api/fracionamento`
Lista fracionamentos do tenant (com fracoes e produto vinculado).
**Permissao:** qualquer usuario autenticado (modulo FRACIONAMENTO habilitado)
**Query:** `loteId?` — filtra por lote de origem

### `POST /api/fracionamento`
Registra novo evento de fracionamento.
**Permissao:** `FRACIONAMENTO_GERENCIAR`
**Body:** `{ loteId, quantidadeFracionada, fracoes: [{ quantidade, unidade, destinacao? }], obs? }`
**Nota NeonHttp:** `FracaoItem` criados via `Promise.all` separado do `FracionamentoLote.create`.
**Retorna:** `{ ...fracionamento, fracoes: [] }` — status `201`

### `PATCH /api/fracionamento/{id}`
Atualiza observacoes do fracionamento.
**Permissao:** `FRACIONAMENTO_GERENCIAR`

### `GET /api/fracionamento/{id}/etiqueta`
Gera PDF de etiquetas 80x50mm com QR Code para todas as fracoes do evento.
**Permissao:** `FRACIONAMENTO_GERENCIAR`
**Retorna:** `application/pdf` — QR Code por fracao encoda produto, lote, validade, quantidade e numero da fracao.
**Efeito:** registra `etiquetaImpressaEm` para fracoes sem timestamp, cria AuditLog `ETIQUETA_IMPRESSA`.

---

## Perfil do Usuario

### `GET /api/perfil`
Retorna dados do usuario autenticado.
**Retorna:** `{ nome, email, crf, permissions, createdAt }`

### `PATCH /api/perfil`
Atualiza nome e/ou CRF do usuario autenticado.
**Body:** `{ nome?, crf? }`

### `POST /api/perfil/senha`
Altera a senha do usuario autenticado.
**Body:** `{ senhaAtual, novaSenha }`
**Validacao:** `senhaAtual` comparada com `bcrypt.compare`; nova senha hasheada com `bcrypt.hash(novaSenha, 10)`.
**Retorna:** `400` se senha atual incorreta.
