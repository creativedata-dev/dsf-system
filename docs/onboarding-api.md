# FarmaSign — Integração de Onboarding via Landing Page

**Versão:** 1.0  
**Base URL (produção):** `https://app.farmasign.com.br`  
**Autenticação:** nenhuma — endpoint público

---

## Visão Geral do Fluxo

```
Landing Page                        FarmaSign API                       Banco
     │                                    │                               │
     │  POST /api/onboarding              │                               │
     │ ─────────────────────────────────► │  Valida campos                │
     │                                    │  Verifica e-mail único ──────►│
     │                                    │  Busca plano TRIAL ──────────►│
     │                                    │  Cria Tenant ────────────────►│
     │                                    │  Cria User (admin) ──────────►│
     │                                    │  Cria Assinatura TRIAL ──────►│
     │  { ok: true, email }               │  Grava AuditLog ─────────────►│
     │ ◄───────────────────────────────── │                               │
     │                                    │
     │  signIn('credentials', {...})       │  (NextAuth — mesmo domínio)
     │ ─────────────────────────────────► │
     │  { ok: true }                      │
     │ ◄───────────────────────────────── │
     │
     │  window.location.href = '/dashboard'   ← hard navigation obrigatória
```

A landing page faz **duas chamadas em sequência**: registra o tenant via API, depois autentica via NextAuth e redireciona. O redirecionamento **deve ser `window.location.href`** (não `router.push`) para limpar o Router Cache do Next.js.

---

## Endpoint

### `POST /api/onboarding`

#### Request

```http
POST https://app.farmasign.com.br/api/onboarding
Content-Type: application/json

{
  "nomeFantasia":    "Drogaria Central",
  "responsavelNome": "João Silva",
  "email":           "joao@drogcentral.com",
  "senha":           "minhasenha123"
}
```

| Campo             | Tipo     | Obrigatório | Validação                         |
|-------------------|----------|-------------|-----------------------------------|
| `nomeFantasia`    | `string` | sim         | ≥ 3 caracteres                    |
| `responsavelNome` | `string` | sim         | ≥ 3 caracteres                    |
| `email`           | `string` | sim         | formato válido, único no sistema  |
| `senha`           | `string` | sim         | ≥ 8 caracteres                    |

#### Response — Sucesso `200 OK`

```json
{
  "ok": true,
  "email": "joao@drogcentral.com"
}
```

#### Responses — Erro

| Status | Quando ocorre                                 | Corpo                                                     |
|--------|-----------------------------------------------|-----------------------------------------------------------|
| `400`  | JSON malformado                               | `{ "error": "JSON inválido." }`                          |
| `409`  | E-mail já cadastrado no sistema               | `{ "error": "Este e-mail já está cadastrado..." }`       |
| `422`  | Campo inválido (tamanho, formato)             | `{ "error": "mensagem específica do campo" }`            |
| `429`  | Rate-limit: mais de 1 req por IP por minuto   | `{ "error": "Muitas tentativas. Aguarde 1 minuto." }`    |
| `503`  | Nenhum plano TRIAL ativo cadastrado no admin  | `{ "error": "Serviço temporariamente indisponível..." }` |

---

## O que é criado no banco

Ao registrar com sucesso, a API cria **3 registros** em sequência:

**1. Tenant**

| Campo                | Valor                                             |
|----------------------|---------------------------------------------------|
| `nomeFantasia`       | valor enviado no body                             |
| `tipoImpressao`      | `BOBINA_80MM` (padrão, alterável em Configurações)|
| `modulosHabilitados` | `[]` — array vazio = todos os módulos habilitados |
| demais campos        | `null` — preenchidos depois em Configurações → Geral |

**2. User (administrador)**

| Campo         | Valor                                    |
|---------------|------------------------------------------|
| `nome`        | `responsavelNome`                        |
| `email`       | `email` normalizado em lowercase         |
| `senhaHash`   | `bcrypt(senha, cost=12)`                 |
| `permissions` | todas exceto `SUPER_ADMIN_GLOBAIS`       |

Permissões concedidas ao primeiro usuário:
```
CLIENTE_BUSCAR, CLIENTE_CADASTRAR, DSF_EMITIR, DSF_CANCELAR,
ANVISA_RELATORIOS, DRIVE_CONFIGURAR, TEMPERATURA_GERENCIAR,
EQUIPAMENTOS_GERENCIAR, POPS_GERENCIAR, VALIDADE_GERENCIAR,
PAINEL_FISCAL_GERENCIAR, FRACIONAMENTO_GERENCIAR
```

> `SUPER_ADMIN_GLOBAIS` nunca é concedido via onboarding — é exclusivo da equipe FarmaSign.

**3. Assinatura TRIAL**

| Campo          | Valor                                             |
|----------------|---------------------------------------------------|
| `status`       | `TRIAL`                                           |
| `trialExpiraEm`| `agora + plano.trialDias` (padrão: 14 dias)       |
| `planoId`      | primeiro Plano com `tipo=TRIAL` e `ativo=true`    |

---

## Implementação de Referência

### React + NextAuth (landing page no mesmo domínio)

```tsx
'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export function FormOnboarding() {
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const form  = e.currentTarget
    const dados = {
      nomeFantasia:    (form.elements.namedItem('nomeFantasia')    as HTMLInputElement).value,
      responsavelNome: (form.elements.namedItem('responsavelNome') as HTMLInputElement).value,
      email:           (form.elements.namedItem('email')           as HTMLInputElement).value,
      senha:           (form.elements.namedItem('senha')           as HTMLInputElement).value,
    }

    try {
      // 1. Criar conta
      const res  = await fetch('https://app.farmasign.com.br/api/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(dados),
      })
      const json = await res.json()

      if (!res.ok) {
        setErro(json.error ?? 'Erro ao criar conta.')
        return
      }

      // 2. Autenticar automaticamente via NextAuth
      const auth = await signIn('credentials', {
        email:    json.email,
        password: dados.senha,
        redirect: false,
      })

      if (!auth?.ok) {
        setErro('Conta criada! Acesse app.farmasign.com.br/auth/login para entrar.')
        return
      }

      // 3. Hard navigation — obrigatório para limpar o Router Cache do Next.js
      window.location.href = 'https://app.farmasign.com.br/dashboard'

    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="nomeFantasia"    placeholder="Nome da farmácia"       required minLength={3} />
      <input name="responsavelNome" placeholder="Seu nome completo"      required minLength={3} />
      <input name="email"           placeholder="seu@email.com"          required type="email" />
      <input name="senha"           placeholder="Senha (mín. 8 dígitos)" required minLength={8} type="password" />

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Criando conta...' : 'Começar grátis'}
      </button>
    </form>
  )
}
```

---

### HTML + JavaScript puro (Webflow, landing page estática)

Para landing pages sem React, hospedadas em domínio diferente de `app.farmasign.com.br`:

```html
<form id="form-cadastro">
  <input id="nomeFantasia"    placeholder="Nome da farmácia"       required>
  <input id="responsavelNome" placeholder="Seu nome completo"      required>
  <input id="email"           placeholder="seu@email.com"          type="email"    required>
  <input id="senha"           placeholder="Senha (mín. 8 dígitos)" type="password" required minlength="8">
  <p id="erro" style="color:red; display:none"></p>
  <button type="submit" id="btn">Começar grátis</button>
</form>

<script>
const FARMASIGN_URL = 'https://app.farmasign.com.br'

document.getElementById('form-cadastro').addEventListener('submit', async function (e) {
  e.preventDefault()

  const btn  = document.getElementById('btn')
  const erro = document.getElementById('erro')
  btn.disabled    = true
  btn.textContent = 'Criando conta...'
  erro.style.display = 'none'

  const dados = {
    nomeFantasia:    document.getElementById('nomeFantasia').value,
    responsavelNome: document.getElementById('responsavelNome').value,
    email:           document.getElementById('email').value,
    senha:           document.getElementById('senha').value,
  }

  try {
    const res  = await fetch(FARMASIGN_URL + '/api/onboarding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(dados),
    })
    const json = await res.json()

    if (!res.ok) {
      erro.textContent   = json.error ?? 'Erro ao criar conta.'
      erro.style.display = 'block'
      return
    }

    // Landing page estática não tem NextAuth — redireciona para login
    // O usuário já sabe a senha pois acabou de escolher
    window.location.href = FARMASIGN_URL + '/auth/login?email=' + encodeURIComponent(json.email)

  } catch {
    erro.textContent   = 'Erro de conexão. Tente novamente.'
    erro.style.display = 'block'
  } finally {
    btn.disabled    = false
    btn.textContent = 'Começar grátis'
  }
})
</script>
```

> **Landing page estática:** como não há NextAuth disponível fora do domínio da aplicação, o fluxo termina no redirecionamento para `/auth/login`. O e-mail é passado via query string para pré-preencher o campo. O usuário digita a senha que acabou de criar.

---

## CORS

O endpoint `/api/onboarding` aceita requisições de qualquer origem. Não é necessária nenhuma configuração adicional na landing page — a chamada `fetch` funciona diretamente de qualquer domínio.

---

## Rate-Limit

| Parâmetro     | Valor                      |
|---------------|----------------------------|
| Limite        | 1 requisição por IP/minuto |
| Reset         | automático após 60 segundos|
| HTTP de bloqueio | `429 Too Many Requests` |
| Implementação | Map em memória (serverless)|

O rate-limit protege contra bots e submissões acidentais repetidas, sem impactar usuários legítimos em condições normais.

---

## Pré-requisito: Plano TRIAL no Painel Admin

A API busca automaticamente o primeiro `Plano` com `tipo = TRIAL` e `ativo = true`. Se não existir, retorna `503`.

**Como verificar/criar:**

1. Entrar com conta `SUPER_ADMIN_GLOBAIS`
2. Navegar para **Admin → Planos**
3. Garantir que existe um plano com:
   - **Tipo:** `TRIAL`
   - **Ativo:** sim
   - **Dias de trial:** `14` (ou o valor desejado para a campanha)

---

## Dashboard após o Onboarding

O novo tenant vê um **banner de boas-vindas** com checklist de 4 passos. O banner some quando todos estiverem concluídos.

| Passo | Condição de conclusão | Destino |
|-------|-----------------------|---------|
| Completar dados da farmácia | CNPJ + endereço + razão social + alvará preenchidos | `/dashboard/geral` |
| Conectar Google Drive | credencial Drive vinculada ao tenant | `/dashboard/configuracoes` |
| Cadastrar primeiro cliente | pelo menos 1 cliente cadastrado | `/dashboard/clientes` |
| Emitir primeira DSF | pelo menos 1 cliente cadastrado | `/dashboard/clientes` |

### Campos para completar nas configurações

Os campos abaixo ficam `null` após o onboarding e são preenchidos em **Configurações → Geral**:

| Campo           | Por que importa                                     |
|-----------------|-----------------------------------------------------|
| CNPJ            | Obrigatório nos relatórios ANVISA                   |
| Razão Social    | Identificação legal da farmácia                     |
| Endereço        | Exibido no cabeçalho das DSFs impressas             |
| Telefone        | Contato para notificações e relatórios              |
| Alvará Sanitário| Número exigido pela RDC 44/2009                     |
| Google Drive    | Backup automático das DSFs em PDF na nuvem          |

---

## Checklist de Go-Live

- [ ] Plano TRIAL criado no painel admin com `ativo = true`
- [ ] Testar fluxo completo: cadastrar → entrar → ver dashboard com banner
- [ ] Confirmar que e-mail duplicado retorna `409` com mensagem amigável
- [ ] Validar senha curta no frontend antes de enviar (atributo `minlength="8"`)
- [ ] Confirmar que o redirecionamento usa `window.location.href` (não `router.push`)
- [ ] Testar no mobile — formulário responsivo, teclado não cobre o botão de envio
- [ ] Verificar que o banner de boas-vindas aparece para o novo tenant
