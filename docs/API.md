# Referencia de API — DSF System

Todas as rotas exigem sessao autenticada via NextAuth (cookie `next-auth.session-token`).  
Respostas de erro seguem o padrao `{ "error": "mensagem legivel" }`.

---

## Autenticacao

### `POST /api/auth/[...nextauth]`

Gerenciado pelo NextAuth.js. Endpoint padrao para login/logout/session/callback.

**Login com credenciais:**
```json
POST /api/auth/callback/credentials
{ "email": "atendente@drogaria.com", "password": "senha" }
```

**Sessao retornada inclui:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Nome do Usuario",
    "email": "email@exemplo.com",
    "tenantId": "uuid",
    "permissions": ["CLIENTE_BUSCAR", "DSF_EMITIR"],
    "crf": null
  }
}
```

---

## Clientes (balcao)

### `GET /api/clients/search`

Busca um cliente pelo CPF dentro do tenant da sessao.

**Permissao:** qualquer usuario autenticado

**Query params:** `cpf` — CPF com ou sem mascara (11 digitos apos strip)

**Respostas:** `200` cliente | `400` CPF invalido | `404` nao encontrado

---

### `POST /api/clients/register`

Cadastra um novo paciente no tenant.

**Permissao:** `CLIENTE_CADASTRAR`

**Body:** `nome`, `cpf`, `dataNascimento`, `sexo` (M|F|Outro), `telefone`, `endereco` (objeto ou string), `email?`, `rg?`

**Respostas:** `201` criado | `400` campos invalidos | `403` sem permissao | `409` CPF duplicado

---

### `PUT /api/clients/update`

Atualiza dados de um cliente (nome, telefone, email, rg, endereco).

**Permissao:** qualquer autenticado (verifica isolamento de tenant)

**Body:** `id`, `nome`, `telefone`, `endereco` (obrigatorios) + `email?`, `rg?`

**Respostas:** `200` atualizado | `403` tenant diferente | `404` nao encontrado

---

### `GET /api/clients/[id]/dsfs`

Retorna historico de DSFs de um cliente (ultimas 20, ordem decrescente).

**Permissao:** qualquer autenticado (verifica isolamento de tenant)

**Resposta `200`:**
```json
{
  "dsfs": [
    {
      "id": "uuid",
      "numeroDsf": "DSF-2026-00001",
      "tipoServico": "GLICEMIA_CAPILAR",
      "tipoServicoLabel": "Glicemia Capilar",
      "dataEmissao": "2026-05-28T10:00:00.000Z",
      "status": "CONCLUIDA",
      "driveFileId": "1BxiMVs0XRA...",
      "observacoes": null,
      "rtNome": "Carlos Farmaceutico",
      "rtCrf": "CRF-SP-11111"
    }
  ]
}
```

---

## DSF

### `POST /api/dsf/create`

Emite uma DSF com status `EMITIDA` (aguarda digitalizacao da assinatura).

**Permissao:** `DSF_EMITIR`

**Body:**
```json
{
  "clienteId": "uuid",
  "tipoServico": "GLICEMIA_CAPILAR",
  "observacoes": "Glicemia: 95 mg/dL.",
  "insumos": [
    { "nomeProduto": "Fita Accu-Chek", "lote": "LT001", "fabricante": "Roche", "validade": "2025-12-31", "quantidade": 1 }
  ]
}
```

**Valores validos para `tipoServico`:** `AFERICAO_PRESSAO_ARTERIAL`, `AFERICAO_TEMPERATURA`, `GLICEMIA_CAPILAR`, `TESTE_RAPIDO_COVID19`, `TESTE_RAPIDO_DENGUE`, `TESTE_RAPIDO_INFLUENZA`, `TESTE_RAPIDO_BETA_HCG`, `TESTE_RAPIDO_PERFIL_LIPIDICO`, `ADMINISTRACAO_INJETAVEIS`, `INALACAO_NEBULIZACAO`, `PERFURACAO_LOBULO`

**Resposta `200`:** payload completo para impressao do cupom (dados do tenant, RT, paciente, tipo de servico, logo, tipo de impressao).

**Respostas de erro:** `400` invalido | `403` sem permissao | `404` cliente nao encontrado | `422` sem RT no tenant

---

### `POST /api/dsf/upload-signed`

Recebe a foto ou PDF do cupom assinado, converte para PDF se necessario, faz upload para o Drive e conclui a DSF.

**Permissao:** qualquer autenticado

**Body:**
```json
{ "dsfId": "uuid", "fileBase64": "data:image/jpeg;base64,..." }
```

`fileBase64` aceita:
- `data:image/jpeg;base64,...` — converte imagem → PDF via pdf-lib
- `data:image/png;base64,...` — idem
- `data:application/pdf;base64,...` — faz upload do PDF diretamente sem conversao

**Resposta `200`:**
```json
{ "status": "CONCLUIDA", "driveFileId": "1BxiMV...", "warning": null }
```

`warning` contem mensagem se o Drive nao estava configurado (DSF concluida sem upload).

**Respostas de erro:** `400` campos ausentes | `404` DSF nao encontrada | `409` DSF ja concluida

---

### `GET /api/dsf/list`

Lista DSFs do tenant com filtros e paginacao.

**Permissao:** `ANVISA_RELATORIOS`

**Query params:**

| Param | Tipo | Descricao |
|---|---|---|
| `page` | number | Pagina (default: 1, 20 por pagina) |
| `dateFrom` | string (ISO date) | Data inicial da emissao |
| `dateTo` | string (ISO date) | Data final da emissao (ate 23:59:59) |
| `status` | string | `EMITIDA` \| `CONCLUIDA` \| `CANCELADA` |
| `tipoServico` | string | Valor do enum TipoServico |
| `format` | string | `csv` — retorna arquivo CSV com BOM UTF-8 (sem paginacao) |

**Resposta `200` (JSON):**
```json
{
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3,
  "dsfs": [
    {
      "id": "uuid",
      "numeroDsf": "DSF-2026-00001",
      "tipoServico": "GLICEMIA_CAPILAR",
      "tipoServicoLabel": "Glicemia Capilar",
      "dataEmissao": "2026-05-28T10:00:00.000Z",
      "status": "CONCLUIDA",
      "driveFileId": "1BxiMV...",
      "clienteNome": "Maria Silva",
      "clienteCpf": "12345678901",
      "rtNome": "Carlos Farmaceutico",
      "rtCrf": "CRF-SP-11111",
      "atendenteNome": "Juliana Atendente"
    }
  ]
}
```

**Resposta `200` (`format=csv`):** arquivo `dsf-YYYY-MM-DD.csv` com cabecalho e BOM UTF-8.

---

### `POST /api/dsf/cancel`

Cancela uma DSF.

**Permissao:** `DSF_CANCELAR`

**Body:**
```json
{ "dsfId": "uuid", "motivo": "Erro de digitacao" }
```

`motivo` e opcional. Quando informado, e salvo nas `observacoes` da DSF como `[CANCELADA: motivo]`.

**Resposta `200`:** `{ "ok": true, "numeroDsf": "DSF-2026-00001" }`

**Respostas de erro:** `400` dsfId ausente | `404` nao encontrada | `409` ja cancelada

---

## Admin — Clientes

### `GET /api/admin/clients`

Lista paginada de clientes com busca.

**Permissao:** `SUPER_ADMIN_GLOBAIS` | `ANVISA_RELATORIOS` | `DSF_CANCELAR` | `DRIVE_CONFIGURAR`

**Query params:**

| Param | Descricao |
|---|---|
| `page` | Pagina (default 1, 25 por pagina) |
| `q` | Busca por nome ou CPF |
| `tenantId` | Filtro por tenant (apenas `SUPER_ADMIN_GLOBAIS`) |

**Resposta `200`:** `{ total, page, pageSize, totalPages, clientes[], tenants[], isSuperAdmin }`

---

### `GET /api/admin/clients/[id]`

Dados completos de um cliente + historico de DSFs com insumos.

**Permissao:** admin (mesma regra acima). Super Admin pode acessar qualquer tenant.

**Resposta `200`:**
```json
{
  "cliente": { "id", "nome", "cpf", "rg", "dataNascimento", "sexo", "telefone", "email", "endereco", "consentimentoLgpdAt", "createdAt", "updatedAt" },
  "dsfs": [
    {
      "id", "numeroDsf", "tipoServico", "tipoServicoLabel", "dataEmissao", "status", "driveFileId", "observacoes",
      "rtNome", "rtCrf", "atendenteNome",
      "insumos": [{ "nomeProduto", "lote", "fabricante", "validade", "quantidade", "unidade" }]
    }
  ]
}
```

---

### `PATCH /api/admin/clients/[id]`

Atualiza dados de um cliente (admin-scoped — Super Admin pode editar qualquer tenant).

**Body (campos opcionais):** `nome`, `telefone`, `email`, `rg`, `endereco`

**Resposta `200`:** dados atualizados do cliente + AuditLog `CLIENTE_ATUALIZADO`

---

## Admin — Usuarios

### `GET /api/admin/users`

Lista usuarios.

**Permissao:** `SUPER_ADMIN_GLOBAIS` | `ANVISA_RELATORIOS` | `DSF_CANCELAR` | `DRIVE_CONFIGURAR`

**Query params:** `tenantId` — filtra por tenant (apenas `SUPER_ADMIN_GLOBAIS`)

**Comportamento:**
- `SUPER_ADMIN_GLOBAIS`: retorna todos os usuarios + lista de tenants
- Outros: retorna apenas usuarios do proprio tenant

**Resposta `200`:** `{ users[], tenants[], isSuperAdmin }`

---

### `POST /api/admin/users`

Cria um novo usuario.

**Permissao:** admin (mesma regra)

**Body:**
```json
{
  "tenantId": "uuid",
  "nome": "Maria Santos",
  "email": "maria@drogaria.com",
  "senha": "minimo8chars",
  "permissions": ["CLIENTE_BUSCAR", "DSF_EMITIR"],
  "crf": "CRF-SP-00000"
}
```

`tenantId` so e respeitado para `SUPER_ADMIN_GLOBAIS`. Senha e cifrada com bcrypt (cost 12). Tenant admin nao pode conceder `SUPER_ADMIN_GLOBAIS`.

**Respostas:** `201` criado | `403` escalada de privilegio | `404` tenant nao existe | `409` e-mail duplicado no tenant

---

### `PATCH /api/admin/users/[id]`

Atualiza dados de um usuario.

**Body (campos opcionais):** `nome`, `email`, `senha`, `permissions`, `crf`, `ativo`

**Protecoes:**
- Tenant admin nao pode editar usuarios de outros tenants
- Tenant admin nao pode conceder `SUPER_ADMIN_GLOBAIS`
- Qualquer admin nao pode se auto-desativar
- Qualquer admin nao pode remover suas proprias permissoes administrativas

**Resposta `200`:** usuario atualizado + AuditLog `USUARIO_ATUALIZADO`

---

## Admin — Tenants

### `GET /api/admin/tenants`

Lista todos os tenants com contagem de usuarios e DSFs.

**Permissao:** `SUPER_ADMIN_GLOBAIS`

**Resposta `200`:** `{ tenants[] }` com `_count: { users, dsfs }`

---

### `POST /api/admin/tenants`

Cria um novo tenant.

**Permissao:** `SUPER_ADMIN_GLOBAIS`

**Body:**
```json
{
  "nomeFantasia": "Farmacia Central",
  "razaoSocial": "Farmacia Central Ltda",
  "cnpj": "12.345.678/0001-99",
  "endereco": "Rua das Flores, 42 - Centro, Rio/RJ",
  "telefone": "(21) 3333-4444",
  "alvaraSanitario": "VISA-RJ-2024-00001",
  "tipoImpressao": "BOBINA_80MM"
}
```

CNPJ e validado (14 digitos) e deve ser unico. `tipoImpressao`: `BOBINA_80MM` (default) | `FOLHA_A4`.

**Respostas:** `201` criado | `400` CNPJ invalido | `409` CNPJ duplicado

---

### `PATCH /api/admin/tenants/[id]`

Atualiza dados de um tenant.

**Permissao:** `SUPER_ADMIN_GLOBAIS`

**Body (campos opcionais):** `nomeFantasia`, `razaoSocial`, `cnpj`, `endereco`, `telefone`, `alvaraSanitario`, `tipoImpressao`, `logoUrl` (base64 WebP), `ativo`

**Resposta `200`:** tenant atualizado + AuditLog `TENANT_ATUALIZADO`

---

## Integracoes — Google Drive

### `GET /api/integrations/google-drive`

Redireciona para a tela de consentimento OAuth do Google.

**Permissao:** `DRIVE_CONFIGURAR`

**Escopos solicitados:** `drive.file`, `userinfo.email`

---

### `GET /api/integrations/google-drive/callback`

Callback OAuth. Troca o `code` por tokens, cria pasta no Drive, salva `DriveCredential` cifrada.

Apos sucesso, redireciona para `/dashboard/configuracoes?drive=conectado`.

---

### `GET /api/integrations/google-drive/status`

Retorna status da integracao do tenant.

**Resposta `200`:**
```json
{ "connected": true, "connectedSince": "...", "lastSync": "...", "folderId": "..." }
```

---

### `POST /api/integrations/google-drive/disconnect`

Remove a integracao e deleta `DriveCredential` do banco.

---

## Cron

### `GET /api/cron/cleanup-dsf`

Cancela DSFs com status `EMITIDA` ha mais de 24h (abandono de fluxo).

**Autenticacao:** `Authorization: Bearer {CRON_SECRET}`

**Resposta `200`:** `{ "cancelled": 3 }`

---

## Codigos de Erro

| HTTP | Significado |
|---|---|
| `400` | Dados invalidos ou ausentes |
| `401` | Sessao ausente ou expirada |
| `403` | Sem permissao para a acao |
| `404` | Recurso nao encontrado (ou fora do tenant) |
| `409` | Conflito — duplicidade de CPF, CNPJ ou e-mail |
| `422` | Entidade inprocessavel — ex: sem RT no tenant |
| `500` | Erro interno (ver logs Vercel) |
