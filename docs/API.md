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

## Clientes

### `GET /api/clients/search`

Busca um cliente pelo CPF dentro do tenant da sessao.

**Permissao:** qualquer usuario autenticado (verificacao de tenant implicita)

**Query params:**
| Param | Tipo | Descricao |
|---|---|---|
| `cpf` | string | CPF com ou sem mascara (11 digitos apos strip) |

**Respostas:**
- `200` — cliente encontrado
- `400` — CPF invalido (menos de 11 digitos)
- `401` — nao autenticado
- `404` — CPF nao cadastrado neste tenant

**Exemplo de resposta `200`:**
```json
{
  "id": "uuid",
  "nome": "Maria da Silva",
  "cpf": "12345678901",
  "rg": null,
  "dataNascimento": "1985-06-15T00:00:00.000Z",
  "sexo": "F",
  "telefone": "(21) 99999-0000",
  "email": null,
  "endereco": "Rua das Flores, 42 - Centro, Rio de Janeiro/RJ - CEP: 20000000",
  "consentimentoLgpdAt": "2026-05-27T21:00:00.000Z",
  "updatedAt": "2026-05-27T21:00:00.000Z"
}
```

---

### `POST /api/clients/register`

Cadastra um novo paciente no tenant.

**Permissao:** `CLIENTE_CADASTRAR`

**Body:**
```json
{
  "nome": "Jose Oliveira",
  "cpf": "98765432100",
  "dataNascimento": "1990-03-22",
  "sexo": "M",
  "telefone": "(21) 98888-1234",
  "email": "jose@email.com",
  "rg": "1234567",
  "endereco": {
    "cep": "20000000",
    "logradouro": "Rua das Flores",
    "numero": "100",
    "complemento": "Apto 3",
    "bairro": "Centro",
    "cidade": "Rio de Janeiro",
    "uf": "RJ"
  }
}
```

Campos obrigatorios: `nome`, `cpf`, `dataNascimento`, `sexo` (`M`|`F`|`Outro`), `telefone`, `endereco` (com logradouro, numero, bairro, cidade, uf).

**Respostas:**
- `201` — cliente criado (retorna o objeto do cliente)
- `400` — campos obrigatorios ausentes ou invalidos
- `401` — nao autenticado
- `403` — sem permissao `CLIENTE_CADASTRAR`
- `409` — CPF ja cadastrado neste tenant

---

### `PUT /api/clients/update`

Atualiza dados de um cliente existente.

**Permissao:** qualquer usuario autenticado (verifica isolamento de tenant)

**Body:**
```json
{
  "id": "uuid-do-cliente",
  "nome": "Jose Oliveira Santos",
  "telefone": "(21) 97777-5678",
  "email": "jose.novo@email.com",
  "rg": "9876543",
  "endereco": {
    "cep": "22000000",
    "logradouro": "Av. Atlantica",
    "numero": "500",
    "complemento": "",
    "bairro": "Copacabana",
    "cidade": "Rio de Janeiro",
    "uf": "RJ"
  }
}
```

`endereco` pode ser string (manter atual) ou objeto estruturado (atualizar).

**Respostas:**
- `200` — dados atualizados (retorna o objeto completo atualizado)
- `400` — campos obrigatorios ausentes
- `401` — nao autenticado
- `403` — cliente pertence a outro tenant
- `404` — cliente nao encontrado

---

## DSF

### `POST /api/dsf/create`

Emite uma DSF, gera o PDF e envia para o Google Drive do tenant.

**Permissao:** `DSF_EMITIR`

**Body:**
```json
{
  "clienteId": "uuid-do-cliente",
  "tipoServico": "GLICEMIA_CAPILAR",
  "observacoes": "Paciente em jejum de 8h. Glicemia capilar: 95 mg/dL.",
  "insumos": [
    {
      "nomeProduto": "Fita Reagente Accu-Chek",
      "lote": "LT2024001",
      "fabricante": "Roche",
      "validade": "2025-12-31",
      "quantidade": 1
    }
  ]
}
```

**Campos obrigatorios:** `clienteId`, `tipoServico` (valor do enum `TipoServico`), `insumos` (ao menos 1).

**Valores validos para `tipoServico`:**

| Valor | Descricao |
|---|---|
| `AFERICAO_PRESSAO_ARTERIAL` | Afericao de Pressao Arterial |
| `AFERICAO_TEMPERATURA` | Afericao de Temperatura Corporal |
| `GLICEMIA_CAPILAR` | Glicemia Capilar |
| `TESTE_RAPIDO_COVID19` | Teste Rapido COVID-19 |
| `TESTE_RAPIDO_DENGUE` | Teste Rapido Dengue |
| `TESTE_RAPIDO_INFLUENZA` | Teste Rapido Influenza A/B |
| `TESTE_RAPIDO_BETA_HCG` | Teste Rapido Beta-HCG (Gravidez) |
| `TESTE_RAPIDO_PERFIL_LIPIDICO` | Teste Rapido Perfil Lipidico |
| `ADMINISTRACAO_INJETAVEIS` | Administracao de Injetaveis |
| `INALACAO_NEBULIZACAO` | Inalacao / Nebulizacao |
| `PERFURACAO_LOBULO` | Perfuracao de Lobulo |

**Logica do Responsavel Tecnico:**
1. Operador com `ANVISA_RELATORIOS` → ele mesmo assina
2. Sem → busca o primeiro usuario ativo do tenant com `ANVISA_RELATORIOS`
3. Nenhum encontrado → `422`

**Respostas:**
- `200` — DSF criada

```json
{
  "id": "uuid",
  "numeroDsf": "DSF-2026-00001",
  "status": "CONCLUIDA",
  "driveFileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
}
```

`status` sera `EM_ANDAMENTO` se o upload para o Drive falhar (Drive nao configurado ou erro de conexao). A DSF fica salva no banco independentemente.

- `400` — clienteId ou tipoServico invalido / sem insumos
- `401` — nao autenticado
- `403` — sem permissao `DSF_EMITIR`
- `404` — cliente nao pertence ao tenant
- `422` — nenhum RT habilitado no tenant

---

## Cron

### `GET /api/cron/cleanup-dsf`

Marca como `CANCELADA` DSFs que ficaram `EM_ANDAMENTO` por mais de 24h.

**Autenticacao:** Header `Authorization: Bearer {CRON_SECRET}`

**Resposta `200`:**
```json
{ "cancelled": 3 }
```

Configurado para rodar diariamente as 03:00 UTC pelo `vercel.json`.

---

## Codigos de Erro Comuns

| HTTP | Significado |
|---|---|
| `400` | Dados invalidos ou ausentes no body/query |
| `401` | Sessao ausente ou expirada |
| `403` | Sem permissao para a acao |
| `404` | Recurso nao encontrado (ou nao pertence ao tenant) |
| `409` | Conflito — ex: CPF duplicado |
| `422` | Entidade inprocessavel — ex: sem RT no tenant |
| `500` | Erro interno (ver logs Vercel) |
