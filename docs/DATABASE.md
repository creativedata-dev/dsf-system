# Banco de Dados — FarmaSign

Neon PostgreSQL (serverless, regiao sa-east-1).
ORM: Prisma 7.x com adapter HTTP (`PrismaNeonHttp`) — sem conexoes persistentes.

> **Restricao critica:** `upsert`, `createMany`, `updateMany` e `$transaction` nao funcionam com NeonHttp. Use `find + create/update` manual e `Promise.all` de operacoes individuais.

---

## Diagrama de Entidades

```
Tenant (1)
  ├── User (N)
  ├── Cliente (N)
  ├── DSF (N)
  │     └── InsumoDSF (N)
  ├── DriveCredential (0-1)
  ├── Assinatura (0-1)  ──► Plano
  │     └── PagamentoLog (N)
  ├── ProcedimentoConfig (N)
  └── AuditLog (N)

Plano (N)          — configuracao global, sem tenantId
GatewayConfig (N)  — configuracao global, sem tenantId
```

---

## Enums

### `Permission`
```
CLIENTE_BUSCAR    CLIENTE_CADASTRAR
DSF_EMITIR        DSF_CANCELAR
ANVISA_RELATORIOS DRIVE_CONFIGURAR
SUPER_ADMIN_GLOBAIS
```

### `TipoServico`
```
AFERICAO_PRESSAO_ARTERIAL   AFERICAO_TEMPERATURA
GLICEMIA_CAPILAR
TESTE_RAPIDO_COVID19        TESTE_RAPIDO_DENGUE
TESTE_RAPIDO_INFLUENZA      TESTE_RAPIDO_BETA_HCG
TESTE_RAPIDO_PERFIL_LIPIDICO
ADMINISTRACAO_INJETAVEIS    INALACAO_NEBULIZACAO
PERFURACAO_LOBULO
```

### `DsfStatus`
```
EMITIDA    upload pendente (aguardando digitalizacao do cupom)
CONCLUIDA  PDF salvo no Drive com sucesso
CANCELADA  cancelada manualmente ou pelo cron (timeout 24h)
```

### `TipoImpressao`
```
BOBINA_80MM   FOLHA_A4
```

### `TipoPlano`
```
TRIAL   MENSAL   ANUAL   VITALICIO
```

### `StatusAssinatura`
```
TRIAL      ATIVA      SUSPENSA
CANCELADA  EXPIRADA
```

### `StatusPagamento`
```
PENDENTE   APROVADO   RECUSADO
REEMBOLSADO   ESTORNADO
```

### `AuditAcao`
```
LOGIN  LOGOUT
CLIENTE_CRIADO  CLIENTE_ATUALIZADO
DSF_CRIADA  DSF_CONCLUIDA  DSF_CANCELADA  DSF_VISUALIZADA
DRIVE_AUTORIZADO  DRIVE_REVOGADO
USUARIO_CRIADO  USUARIO_ATUALIZADO
TENANT_CRIADO  TENANT_ATUALIZADO
CRON_CLEANUP_DSF
ASSINATURA_CRIADA  ASSINATURA_ATUALIZADA  ASSINATURA_CANCELADA  ASSINATURA_EXPIRADA
PAGAMENTO_REGISTRADO
PLANO_CRIADO  PLANO_ATUALIZADO
```

---

## Modelos

### `Tenant`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `nomeFantasia` | String | Nome exibido no sistema e no PDF |
| `razaoSocial` | String | Razao social juridica |
| `cnpj` | String UNIQUE | Somente digitos |
| `endereco` | String | |
| `telefone` | String | |
| `alvaraSanitario` | String | Numero do alvara ANVISA |
| `logoUrl` | String? | Base64 WebP max 320x160px |
| `tipoImpressao` | TipoImpressao | Default `BOBINA_80MM` |
| `ativo` | Boolean | Tenant inativo nao consegue logar |

---

### `User`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant | |
| `nome` | String | |
| `email` | String | `@@unique([tenantId, email])` |
| `senhaHash` | String | bcrypt hash (custo 12) |
| `permissions` | Permission[] | Default `[CLIENTE_BUSCAR, DSF_EMITIR]` |
| `crf` | String? | Obrigatorio para assinar DSF como RT |
| `ativo` | Boolean | |

---

### `Cliente`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant | |
| `nome` | String | |
| `cpf` | String | Somente digitos — `@@unique([tenantId, cpf])` |
| `dataNascimento` | Date | `@db.Date` |
| `sexo` | String | `M`, `F` ou `Outro` |
| `telefone` | String | |
| `email` | String? | |
| `endereco` | String | |
| `consentimentoLgpdAt` | DateTime | Obrigatorio LGPD |

---

### `DSF`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant | |
| `numeroDsf` | String | `DSF-YYYY-NNNNN` — `@@unique([tenantId, numeroDsf])` |
| `clienteId` | FK Cliente | |
| `responsavelTecnicoId` | FK User | Farmaceutico que assina |
| `atendenteId` | FK User | Operador que emitiu |
| `tipoServico` | TipoServico | |
| `observacoes` | String? | Anamnese livre |
| `status` | DsfStatus | Default `EMITIDA` |
| `driveFileId` | String? | ID do arquivo no Google Drive |

**Indices:** `[tenantId, dataEmissao DESC]`, `[status, updatedAt]`, `[clienteId]`

---

### `InsumoDSF`
| Campo | Tipo | Descricao |
|---|---|---|
| `dsfId` | FK DSF | |
| `nomeProduto` | String | |
| `lote` | String | Obrigatorio ANVISA |
| `fabricante` | String | |
| `validade` | Date | |
| `quantidade` | Decimal(10,3) | |
| `unidade` | String | Default `"un"` |

---

### `DriveCredential`
| Campo | Tipo | Descricao |
|---|---|---|
| `tenantId` | FK Tenant UNIQUE | Um Drive por tenant |
| `accessToken` | String | Criptografado AES-256-GCM |
| `refreshToken` | String | Criptografado AES-256-GCM |
| `tokenExpiry` | DateTime | Verificado antes de cada upload |
| `driveFolderId` | String | ID da pasta raiz no Drive |
| `driveEmail` | String? | Email da conta Google conectada |

---

### `ProcedimentoConfig`
| Campo | Tipo | Descricao |
|---|---|---|
| `tenantId` | FK Tenant | |
| `tipoServico` | TipoServico | `@@unique([tenantId, tipoServico])` |
| `ativo` | Boolean | Default `true` — se `false`, servico some do select de emissao |
| `textoOrientacao` | String? | Texto impresso abaixo do servico no DSF |

Se nenhuma config existir para um tenant, todos os servicos aparecem ativos por padrao.

---

### `Plano`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `nome` | String | Ex: "Mensal", "Anual Plus" |
| `tipo` | TipoPlano | |
| `precoMensal` | Int? | Em centavos |
| `precoAnual` | Int? | Em centavos |
| `limiteUsuarios` | Int? | null = ilimitado |
| `limiteDsfsMes` | Int? | null = ilimitado |
| `trialDias` | Int? | Apenas para tipo TRIAL |
| `ativo` | Boolean | Planos inativos nao aparecem no select |
| `stripeMonthlyPriceId` | String? | Price ID Stripe (criado e salvo no primeiro checkout) |
| `stripeAnnualPriceId` | String? | |
| `stripeOnetimePriceId` | String? | Para vitalicio |

---

### `Assinatura`
| Campo | Tipo | Descricao |
|---|---|---|
| `tenantId` | FK Tenant UNIQUE | Uma assinatura por tenant |
| `planoId` | FK Plano | |
| `status` | StatusAssinatura | Default `TRIAL` |
| `inicioEm` | DateTime | |
| `expiraEm` | DateTime? | null = vitalicio |
| `trialExpiraEm` | DateTime? | |
| `canceladaEm` | DateTime? | |
| `motivoCancelamento` | String? | |
| `gateway` | String? | `"stripe"`, `"asaas"`, etc. |
| `gatewayCustomerId` | String? | Stripe customer_id |
| `gatewaySubscriptionId` | String? | Stripe subscription_id |
| `obs` | String? | Observacoes internas |

**Indice:** `[status, expiraEm]` — cron de expiracao

---

### `PagamentoLog`
| Campo | Tipo | Descricao |
|---|---|---|
| `assinaturaId` | FK Assinatura | |
| `tenantId` | String | Desnormalizado para queries rapidas |
| `valor` | Int | Em centavos |
| `moeda` | String | Default `"BRL"` |
| `status` | StatusPagamento | |
| `gateway` | String | |
| `gatewayPaymentId` | String? | ID do pagamento no gateway |
| `descricao` | String? | Nome do evento (ex: `invoice.payment_succeeded`) |
| `metadados` | Json? | Payload bruto do webhook |

---

### `GatewayConfig`
| Campo | Tipo | Descricao |
|---|---|---|
| `gateway` | String UNIQUE | `"stripe"`, `"asaas"`, `"mercadopago"` |
| `label` | String | Nome de exibicao |
| `secretKeyEncrypted` | String? | Chave secreta criptografada AES-256-GCM |
| `webhookSecretEncrypted` | String? | Webhook secret criptografado |
| `publicKey` | String? | Publishable key (nao secreta) |
| `ativo` | Boolean | Gateway inativo nao aceita pagamentos |
| `modoTeste` | Boolean | Default `true` |

---

### `AuditLog`
| Campo | Tipo | Descricao |
|---|---|---|
| `tenantId` | FK Tenant? | null para acoes de sistema |
| `userId` | FK User? | null para webhooks e crons |
| `acao` | AuditAcao | |
| `recursoTipo` | String | `"DSF"`, `"Assinatura"`, etc. |
| `recursoId` | String | UUID do recurso |
| `ip` | String | IP real (`x-forwarded-for`) |
| `userAgent` | String | |

---

## Migrations

| Migration | Descricao |
|---|---|
| `20260527194031_init` | Schema inicial |
| `20260527205349_pbac_permissions` | Substituicao de Role por Permission[] |
| `20260527215543_update_tipo_servico` | TipoServico conforme ANVISA |
| `20260604_add_drive_email` | DriveCredential.driveEmail |
| `20260604_add_tenant_audit_actions` | AuditAcao TENANT_* |
| `20260604162025_add_procedimento_config` | Modelo ProcedimentoConfig |
| `20260605193458_add_assinatura_plano_pagamento` | Plano, Assinatura, PagamentoLog, enums de pagamento |
| `20260606031524_add_gateway_config_stripe_price_ids` | GatewayConfig + Price IDs no Plano |

```bash
# Aplicar todas as migrations
npx prisma migrate deploy

# Nova migration (desenvolvimento)
npx prisma migrate dev --name descricao

# Regenerar cliente Prisma
npx prisma generate
```

---

## Seed de Desenvolvimento

Arquivo: `prisma/seed.ts`

Cria tenants, usuarios e planos padrao:

| Email | Senha | Perfil | Tenant |
|---|---|---|---|
| `super@dsfsystem.com` | `Super@123` | Super Admin | SaaS Core |
| `admin@drogariario.com` | `Admin@123` | Gestor + RT | Drogaria Rio |
| `farmaceutico@drogariario.com` | `Farma@123` | RT | Drogaria Rio |
| `atendente@drogariario.com` | `Atend@123` | Atendente | Drogaria Rio |

Planos criados: Trial (14 dias), Mensal (R$99), Anual (R$990), Vitalicio.

```bash
npx tsx prisma/seed.ts
```
