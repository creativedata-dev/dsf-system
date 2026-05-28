# Banco de Dados — DSF System

Neon PostgreSQL (serverless, regiao sa-east-1).  
ORM: Prisma 7.x com adapter HTTP (`PrismaNeonHttp`) — sem conexoes persistentes (compativel com Vercel Serverless).

---

## Diagrama de Entidades

```
Tenant (1)
  ├── User (N)              operadores do sistema
  ├── Cliente (N)           pacientes da drogaria
  ├── DSF (N)               declaracoes emitidas
  │     └── InsumoDSF (N)   materiais utilizados por DSF
  ├── DriveCredential (0-1) credenciais OAuth do Google Drive
  └── AuditLog (N)          trilha de auditoria
```

---

## Enums

### `Permission`
```
CLIENTE_BUSCAR
CLIENTE_CADASTRAR
DSF_EMITIR
DSF_CANCELAR
ANVISA_RELATORIOS
DRIVE_CONFIGURAR
SUPER_ADMIN_GLOBAIS
```

### `TipoServico`
```
AFERICAO_PRESSAO_ARTERIAL
AFERICAO_TEMPERATURA
GLICEMIA_CAPILAR
TESTE_RAPIDO_COVID19
TESTE_RAPIDO_DENGUE
TESTE_RAPIDO_INFLUENZA
TESTE_RAPIDO_BETA_HCG
TESTE_RAPIDO_PERFIL_LIPIDICO
ADMINISTRACAO_INJETAVEIS
INALACAO_NEBULIZACAO
PERFURACAO_LOBULO
```

### `DsfStatus`
```
EM_ANDAMENTO   upload pendente (Drive nao configurado ou falha)
CONCLUIDA      PDF salvo no Drive com sucesso
CANCELADA      cancelada manualmente ou pelo cron (timeout 24h)
```

### `AuditAcao`
```
LOGIN  LOGOUT
CLIENTE_CRIADO  CLIENTE_ATUALIZADO
DSF_CRIADA  DSF_CONCLUIDA  DSF_CANCELADA  DSF_VISUALIZADA
DRIVE_AUTORIZADO  DRIVE_REVOGADO
USUARIO_CRIADO  USUARIO_ATUALIZADO
CRON_CLEANUP_DSF
```

---

## Modelos

### `Tenant`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `nomeFantasia` | String | Nome exibido no sistema e no PDF |
| `razaoSocial` | String | Razao social juridica |
| `cnpj` | String UNIQUE | CNPJ formatado |
| `endereco` | String | Endereco completo |
| `telefone` | String | Telefone de contato |
| `alvaraSanitario` | String | Numero do alvara ANVISA |
| `ativo` | Boolean | Tenant desativado nao consegue logar |

---

### `User`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant | Isolamento de dados |
| `nome` | String | |
| `email` | String | `@@unique([tenantId, email])` |
| `senhaHash` | String | bcrypt hash |
| `permissions` | Permission[] | Array — default `[CLIENTE_BUSCAR, DSF_EMITIR]` |
| `crf` | String? | Numero CRF do farmaceutico (obrigatorio para `ANVISA_RELATORIOS`) |
| `ativo` | Boolean | Usuarios desativados nao conseguem logar |

---

### `Cliente`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant | |
| `nome` | String | |
| `cpf` | String | Somente digitos — `@@unique([tenantId, cpf])` |
| `rg` | String? | |
| `dataNascimento` | Date | `@db.Date` — sem fuso horario |
| `sexo` | String | `M`, `F` ou `Outro` |
| `telefone` | String | |
| `email` | String? | |
| `endereco` | String | Endereco completo formatado em string unica |
| `consentimentoLgpdAt` | DateTime | Timestamp do consentimento LGPD — obrigatorio |

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
| `dataEmissao` | DateTime | `@default(now())` |
| `observacoes` | String? | Anamnese livre |
| `status` | DsfStatus | |
| `driveFileId` | String? | ID do arquivo no Google Drive |

**Indices relevantes:**
- `[tenantId, dataEmissao DESC]` — relatorio de fiscalizacao ANVISA
- `[status, updatedAt]` — cron cleanup
- `[clienteId]` — historico do paciente

---

### `InsumoDSF`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `dsfId` | FK DSF | |
| `nomeProduto` | String | Nome do material/reagente |
| `lote` | String | Numero de lote (obrigatorio ANVISA) |
| `fabricante` | String | Fabricante (obrigatorio ANVISA) |
| `validade` | Date | `@db.Date` |
| `quantidade` | Decimal(10,3) | Padrao 1.000 |
| `unidade` | String | Padrao `"un"` |

---

### `DriveCredential`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant UNIQUE | Um Drive por tenant |
| `accessToken` | String | Criptografado AES-256-GCM |
| `refreshToken` | String | Criptografado AES-256-GCM |
| `tokenExpiry` | DateTime | Verificado antes de cada upload |
| `driveFolderId` | String | ID da pasta raiz no Drive do tenant |

---

### `AuditLog`
| Campo | Tipo | Descricao |
|---|---|---|
| `id` | UUID PK | |
| `tenantId` | FK Tenant? | Null para acoes de sistema (cron) |
| `userId` | FK User? | Null para acoes de sistema |
| `acao` | AuditAcao | |
| `recursoTipo` | String | `"DSF"`, `"Cliente"`, etc. |
| `recursoId` | String | UUID do recurso afetado |
| `ip` | String | IP real (`x-forwarded-for`) |
| `userAgent` | String | |
| `createdAt` | DateTime | `@default(now())` |

**Indice:** `[tenantId, createdAt DESC]` — paginacao do painel de auditoria

---

## Migrations

| Migration | Descricao |
|---|---|
| `20260527194031_init` | Schema inicial com Role (obsoleto) e TipoServico antigo |
| `20260527205349_pbac_permissions` | Substituicao de `Role` por `Permission[]` |
| `20260527215543_update_tipo_servico` | Novos valores de `TipoServico` conformes ANVISA |

Para criar uma nova migration:
```bash
npx prisma migrate dev --name descricao_da_mudanca
```

Para regenerar o cliente Prisma apos alteracao do schema:
```bash
npx prisma generate
```

---

## Seed de Desenvolvimento

Arquivo: `prisma/seed.ts`

Cria 2 tenants e 4 usuarios para testes locais:

| Email | Senha | Permissoes | Tenant |
|---|---|---|---|
| `admin@saas.dev` | `admin123` | Todas | SaaS Core |
| `rt@drogaria-rio.dev` | `rt123` | `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR`, `ANVISA_RELATORIOS` | Drogaria Rio |
| `atendente@drogaria-rio.dev` | `atendente123` | `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR` | Drogaria Rio |
| `gerente@drogaria-rio.dev` | `gerente123` | `CLIENTE_BUSCAR`, `CLIENTE_CADASTRAR`, `DSF_EMITIR`, `DSF_CANCELAR`, `DRIVE_CONFIGURAR` | Drogaria Rio |

```bash
npx prisma db seed
```
