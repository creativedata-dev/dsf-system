# Fluxos de Usuario — DSF System

## 1. Maquina de Estados — Pagina de Atendimento

Arquivo: `src/app/dashboard/clientes/page.tsx`

### Estados (Mode)

```
idle                Tela inicial, campo de busca CPF
searching           Aguardando resposta da API de busca
not_found           CPF nao cadastrado — opcoes: cadastrar ou buscar outro
registering         Formulario de novo paciente (preenchimento)
registering_saving  Aguardando POST /api/clients/register
viewing             Ficha do paciente encontrado/cadastrado
editing             Formulario de edicao de dados do paciente
saving              Aguardando PUT /api/clients/update
emitting            Formulario de emissao de DSF
submitting_dsf      Aguardando POST /api/dsf/create
dsf_emitted         Confirmacao de DSF emitida com sucesso
```

### Diagrama de Transicoes

```
idle
  │─ submit CPF ──────────────► searching
                                    │
                    ┌───────────────┼──────────────────┐
                    ▼               ▼                  ▼
                not_found        viewing            idle (erro)
                    │               │
        ┌───────────┤           ┌───┴──────────────────┐
        ▼           ▼           ▼                      ▼
  registering   idle(novo)   editing               emitting
      │          (buscar)       │                      │
      ▼                    ┌────┴─────┐           ┌────┴──────┐
registering_saving         ▼         ▼            ▼           ▼
      │                  saving   viewing(cancel) submitting   viewing(cancel)
      │                    │                         │
      ▼                    ▼                         ▼
   viewing              viewing                  dsf_emitted
                                                     │
                                                     ▼
                                                  viewing
```

### Variaveis de estado auxiliares

| Variavel | Tipo | Descricao |
|---|---|---|
| `cpfInput` | string | CPF digitado pelo usuario (com mascara visual) |
| `searchedCpf` | string | CPF dos digitos (11 nums) da ultima busca |
| `cliente` | ClienteData \| null | Dados do paciente encontrado/cadastrado |
| `emittedDsf` | EmittedDsf \| null | Resultado da ultima DSF emitida |
| `addr` | AddrForm | Formulario de endereco (compartilhado entre registering e editing) |
| `editForm` | EditForm | Campos editaveis do paciente (nome, telefone, email, rg) |
| `regForm` | RegForm | Campos do novo paciente (nome, nascimento, sexo, telefone, email, rg) |
| `regLgpd` | boolean | Checkbox de consentimento LGPD marcado |
| `dsfForm` | DsfForm | Formulario de emissao (tipoServico, observacoes, insumos[]) |

---

## 2. Fluxo de Busca e Atendimento

```
Atendente digita CPF no campo de busca
    │
    └─ Submit ──► GET /api/clients/search?cpf={11 digitos}
                        │
            ┌───────────┼───────────────────────────┐
            │ 200 OK    │ 404 Not Found              │ Erro
            ▼           ▼                            ▼
         viewing     not_found                    idle
         (ficha)     (cadastrar?)             (sem feedback
                        │                      visual —
              ┌─────────┤                      form limpo)
              ▼         ▼
         registering   idle
         (formulario) (busca limpa)
```

---

## 3. Fluxo de Cadastro de Paciente

```
not_found ──► [clicar "Cadastrar novo cliente"] ──► registering

Formulario preenchido:
  - Nome completo *
  - Data de nascimento *
  - Sexo (M / F / Outro) *
  - Telefone *
  - Email (opcional)
  - RG (opcional)
  - Endereco:
      - CEP (busca automatica via ViaCEP)
      - Logradouro * / Numero * / Complemento (opc)
      - Bairro * / Cidade * / UF *
  - Checkbox LGPD *
  
  CPF: herdado da busca (searchedCpf), exibido read-only

[Enviar] ──► registering_saving ──► POST /api/clients/register
                                          │
                              ┌───────────┼──────────────────────────┐
                              │ 201       │ 409 Duplicado             │ Outros erros
                              ▼           ▼                           ▼
                           viewing    regError exibido            regError exibido
                           (ficha)    ("CPF ja cadastrado")       modo volta: registering
```

### Logica ViaCEP

1. Usuario digita CEP (8 digitos)
2. Ao sair do campo (onBlur), fetch `https://viacep.com.br/ws/{cep}/json/`
3. Se valido: preenche logradouro, bairro, cidade, uf automaticamente
4. Se invalido: exibe `cepError` ("CEP nao encontrado")
5. Usuario pode editar os campos mesmo apos auto-preenchimento

---

## 4. Fluxo de Edicao de Dados

```
viewing ──► [clicar "Editar dados"] ──► editing

Campos editaveis:
  - Nome (obrigatorio)
  - Telefone (obrigatorio)
  - Email (opcional)
  - RG (opcional)
  - Endereco completo (CEP + campos — mesmo componente do cadastro)
  
  Logica: se o atendente preencher um CEP no campo de endereco,
  substitui o endereco atual. Se deixar em branco, mantem o endereco
  atual salvo no banco.

[Salvar] ──► saving ──► PUT /api/clients/update
                               │
                   ┌───────────┼──────────────────┐
                   │ 200 OK    │ Erro              │ 403/404
                   ▼           ▼                   ▼
                viewing     saveError           saveError
                (ficha       exibido             exibido
                atualizada)  modo: editing       modo: editing
```

---

## 5. Fluxo de Emissao de DSF

```
viewing ──► [clicar "Emitir DSF"] ──► emitting

Formulario:
  - Tipo de Servico * (select com 11 opcoes)
  - Observacoes / anamnese (opcional, textarea)
  - Insumos (ao menos 1 obrigatorio):
      - Nome do produto *
      - Numero de lote *
      - Fabricante *
      - Validade *
      - Quantidade (default 1, decimal)
      - Unidade (default "un")
  - Botao "+ Adicionar insumo" (ilimitado)
  - Botao de lixeira para remover insumos (minimo 1 mantido)

[Emitir DSF] ──► submitting_dsf ──► POST /api/dsf/create
                                           │
               ┌───────────────────────────┼──────────────────────────┐
               │ 200 OK                    │ 422 (sem RT)             │ Outros erros
               ▼                           ▼                          ▼
           dsf_emitted                  dsfError                   dsfError
           (numero DSF,                 ("Nenhum RT                modo: emitting
            status, link Drive)          habilitado")
               │
               ▼
            viewing (botao "Nova DSF" ou "Voltar")
```

### Logica do Responsavel Tecnico (RT)

Resolvido pela API, sem intervencao do frontend:

```
1. Operador possui ANVISA_RELATORIOS → ele mesmo e o RT
2. Operador nao possui → API busca primeiro usuario ativo do tenant com ANVISA_RELATORIOS
3. Nenhum encontrado → 422 (frontend exibe mensagem de erro)
```

### Status da DSF retornado

| Status | Significado |
|---|---|
| `CONCLUIDA` | PDF gerado e salvo no Google Drive com sucesso |
| `EM_ANDAMENTO` | Drive nao configurado ou falha no upload — DSF salva no banco, PDF pendente |

---

## 6. Fluxo de Permissoes por Perfil

### O que cada usuario ve no dashboard

| Tela | Permissao necessaria | Comportamento sem permissao |
|---|---|---|
| Balcao (`/dashboard/clientes`) | Qualquer autenticado | — |
| Buscar paciente por CPF | Qualquer autenticado | Sempre disponivel |
| Cadastrar paciente | `CLIENTE_CADASTRAR` | Botao "Cadastrar" oculto |
| Editar dados do paciente | Qualquer autenticado | Sempre disponivel |
| Emitir DSF | `DSF_EMITIR` | Botao "Emitir DSF" oculto |
| Cancelar DSF | `DSF_CANCELAR` | (futuro) |
| Relatorios ANVISA | `ANVISA_RELATORIOS` | Sidebar sem item "ANVISA" |
| Config. Drive | `DRIVE_CONFIGURAR` | Sidebar sem item "Drive" |
| Painel Admin | `SUPER_ADMIN_GLOBAIS` ou `ANVISA_RELATORIOS` ou `DSF_CANCELAR` ou `DRIVE_CONFIGURAR` | Redirect para /dashboard/clientes |

### Sidebar adaptativa

O componente `DashboardShell` recebe `permissions` via Server Component e exibe apenas os itens de menu para os quais o usuario tem permissao.

---

## 7. Consentimento LGPD

- Exibido como checkbox obrigatorio no formulario de cadastro
- Texto: "Declaro que o paciente consentiu com a coleta e tratamento de seus dados pessoais conforme a LGPD (Lei 13.709/2018)."
- `consentimentoLgpdAt` salvo como `DateTime` no banco no momento do cadastro
- Exibido na ficha do paciente como "Consentimento LGPD: {data/hora}"
- Sem marcacao do checkbox → frontend bloqueia envio com mensagem de erro

---

## 8. Fluxo de Autenticacao

```
Qualquer rota /dashboard/** sem sessao ──► redirect /auth/login

/auth/login
    │
    ├─ Submit (email + senha)
    │       │
    │       └─► POST /api/auth/callback/credentials (NextAuth)
    │                   │
    │       ┌───────────┼──────────────────────┐
    │       │ Valido    │ Invalido              │ Tenant inativo
    │       ▼           ▼                       ▼
    │   JWT criado   "Credenciais invalidas"   (nao acessa)
    │   redirect
    │   /dashboard
    │
    └─ Sessao JWT inclui: id, tenantId, permissions[], crf?

/dashboard
    │
    ├─ Super Admin / RT / Gerente ──► painel home com widgets de admin
    └─ Atendente ──► redirect /dashboard/clientes (balcao direto)
```

### Estrategia de sessao

- JWT (sem banco para sessoes)
- Expirado → NextAuth redireciona para `/auth/login` automaticamente
- `permissions` e `tenantId` embutidos no JWT — sem lookup adicional por request

---

## 9. Cron Job de Limpeza

```
Todo dia as 03:00 UTC:

Vercel ──► GET /api/cron/cleanup-dsf
           Authorization: Bearer {CRON_SECRET}
                │
                ▼
           Busca DSFs com status=EM_ANDAMENTO
           e updatedAt < agora - 24h
                │
                ▼
           UPDATE status='CANCELADA'
           (bulk)
                │
                ▼
           Registra AuditLog CRON_CLEANUP_DSF
                │
                ▼
           Retorna { cancelled: N }
```

Garante que DSFs travadas em `EM_ANDAMENTO` (Drive nao configurado, falha de rede) sejam encerradas automaticamente em 24h.
