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
dsf_generated       Documento gerado — aguarda impressao e assinatura
dsf_scanning        Captura do cupom assinado (camera ou drag & drop)
dsf_uploading       Aguardando POST /api/dsf/upload-signed
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
      │                  saving   viewing     submitting_dsf  viewing
      │                    │      (cancel)         │          (cancel)
      ▼                    ▼                       ▼
   viewing              viewing             dsf_generated
                                                   │
                                        ┌──────────┴──────────┐
                                        ▼                     ▼
                                    window.print()       dsf_scanning
                                    (impressao)               │
                                                    ┌─────────┴────────┐
                                                    ▼                  ▼
                                              dsf_uploading          viewing
                                              (envio PDF)            (cancel)
                                                    │
                                          ┌─────────┴─────────┐
                                          ▼                   ▼
                                       viewing           dsf_scanning
                                       (concluido)        (erro — retry)
```

### Variaveis de estado auxiliares

| Variavel | Tipo | Descricao |
|---|---|---|
| `cpfInput` | string | CPF digitado (com mascara visual) |
| `searchedCpf` | string | Digitos (11 nums) da ultima busca |
| `cliente` | ClienteData \| null | Dados do paciente encontrado/cadastrado |
| `receiptDsf` | ReceiptDsf \| null | Payload completo retornado pelo create (usado no documento e no upload) |
| `capturedImage` | string \| null | Data URL da foto/arquivo do cupom assinado |
| `isMobile` | boolean | Detectado via `(pointer: coarse)` — define camera vs drag & drop |
| `addr` | AddrForm | Formulario de endereco (compartilhado entre registering e editing) |
| `editForm` | EditForm | Campos editaveis do paciente |
| `regForm` | RegForm | Campos de novo paciente |
| `dsfForm` | DsfForm | tipoServico, observacoes, insumos[] |

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
         (ficha)     (cadastrar?)             (form limpo)
                        │
              ┌─────────┤
              ▼         ▼
         registering   idle
         (formulario) (busca limpa)
```

O widget `CpfSearch` no home redireciona para `/dashboard/clientes?cpf={digits}`.
A pagina detecta o query param no mount e dispara a busca automaticamente.

---

## 3. Fluxo de Cadastro de Paciente

```
not_found ──► [clicar "Cadastrar novo cliente"] ──► registering

Formulario:
  - Nome completo *
  - Data de nascimento *
  - Sexo (M / F / Outro) *
  - Telefone *
  - Email (opcional)
  - RG (opcional)
  - Endereco (CEP com busca ViaCEP, logradouro, numero, bairro, cidade, UF) *
  - Checkbox LGPD *
  CPF: herdado da busca (searchedCpf)

[Cadastrar] ──► registering_saving ──► POST /api/clients/register
                                              │
                              ┌───────────────┼──────────────────┐
                              │ 201           │ 409 Duplicado    │ Outros
                              ▼               ▼                  ▼
                           viewing       regError            regError
```

### ViaCEP

1. Digita CEP (8 digitos) → onBlur dispara `GET viacep.com.br/ws/{cep}/json/`
2. Preenche logradouro, bairro, cidade, UF automaticamente
3. Usuario pode editar os campos preenchidos

---

## 4. Fluxo de Edicao de Dados

```
viewing ──► [Atualizar Dados] ──► editing

Campos editaveis: nome *, telefone *, email, RG, endereco (opcional — so substitui se CEP informado)

[Salvar] ──► saving ──► PUT /api/clients/update
                               │
                   ┌───────────┼──────────┐
                   │ 200 OK    │ Erro     │
                   ▼           ▼          ▼
                viewing    saveError   saveError
```

---

## 5. Fluxo Hibrido de Emissao de DSF

O fluxo e dividido em duas etapas para permitir assinatura fisica:

### Etapa 1 — Emissao (cria registro, imprime documento)

```
viewing ──► [Confirmar Dados e Iniciar DSF] ──► emitting

Formulario:
  - Tipo de Servico * (11 opcoes)
  - Evolucao Farmaceutica e Conduta Proposta (opcional, textarea)
  - Insumos utilizados (opcional):
      - Nome do produto, Lote, Fabricante, Validade *
      - Multiplos insumos suportados
      - Empty state informativo para procedimentos sem descartaveis

[Emitir DSF] ──► submitting_dsf ──► POST /api/dsf/create
                                           │
                       ┌───────────────────┼──────────────────┐
                       │ 200 OK            │ 422 (sem RT)     │ Erro
                       ▼                   ▼                  ▼
                  dsf_generated         dsfError           dsfError
                  (status EMITIDA)
```

### Layout do documento (dsf_generated)

Determinado pelo campo `tipoImpressao` do Tenant:

| Valor | Layout | CSS de impressao |
|---|---|---|
| `BOBINA_80MM` | Cupom termico monoespaco, largura 72mm | `@page { size: 80mm auto }` |
| `FOLHA_A4` | Relatorio clinico com grid, tabela de insumos e bloco de assinaturas | `@page { size: A4 }` |

Ambos incluem: logo do tenant (ou fallback com nome em negrito), CNPJ, responsavel tecnico, paciente, servico prestado, insumos, evolucao farmaceutica, linhas de assinatura ("Profissional Responsavel (CRF/UF)" e "Paciente / Usuario do Servico") e texto legal ANVISA RDC 44/2009.

### Etapa 2 — Digitalizacao (foto do cupom assinado → PDF → Drive)

```
dsf_generated ──► [Digitalizar Cupom Assinado] ──► dsf_scanning

Captura adaptavel ao dispositivo:
  - Mobile (pointer: coarse): camera traseira com viewfinder proporcional
      - Aspecto 0.38 para cupom 80mm
      - Aspecto 0.71 para folha A4
  - Desktop: area de drag & drop ou selecao de arquivo (JPG, PNG)

[Capturar / Selecionar] ──► preview da imagem

[Enviar e Finalizar] ──► dsf_uploading ──► POST /api/dsf/upload-signed
                                                    │
                                        ┌───────────┼──────────────┐
                                        │ 200 OK    │ Erro         │
                                        ▼           ▼              ▼
                                     viewing    dsf_scanning   dsf_scanning
                                     (concluido) (retry)       (retry)
```

### O que o upload-signed faz

1. Recebe `{ dsfId, imageBase64 }` do frontend
2. Converte imagem para PDF via pdf-lib (embed JPEG ou PNG, page size = image size, max 595pt largura)
3. Chama `uploadPdfToDrive(tenantId, numeroDsf-assinado.pdf, pdfBytes)`
   - Se Drive configurado: salva na pasta do tenant, retorna `driveFileId`
   - Se Drive nao configurado: retorna `null` com warning
4. Atualiza DSF: `status = CONCLUIDA`, `driveFileId` (se disponivel)
5. Grava AuditLog `DSF_CONCLUIDA`
6. Retorna `{ status, driveFileId, warning }`

### Status da DSF

| Status | Significado |
|---|---|
| `EMITIDA` | Registro criado, aguardando digitalizacao da assinatura |
| `CONCLUIDA` | Cupom assinado digitalizado; PDF no Drive (ou concluida sem Drive) |
| `CANCELADA` | Cancelada manualmente ou pelo cron de limpeza |

### Logica do Responsavel Tecnico

```
1. Operador possui ANVISA_RELATORIOS → ele mesmo e o RT
2. Operador nao possui → API busca primeiro usuario ativo do tenant com ANVISA_RELATORIOS
3. Nenhum encontrado → 422 Unprocessable Entity
```

---

## 6. Integracao Google Drive

```
/dashboard/configuracoes ──► [Conectar Google Drive da Farmacia]
    │
    └─► GET /api/integrations/google-drive
            │ (gera URL OAuth2, scope: drive.file, access_type: offline, prompt: consent)
            ▼
        Redireciona para Google (tela de consentimento)
            │
            └─► Google redireciona para /api/integrations/google-drive/callback?code=...
                    │
                    ├─ Troca code por tokens (access_token + refresh_token)
                    ├─ Cria pasta "DSF System — {tenantNome}" no Drive
                    ├─ Salva DriveCredential no banco (tokens cifrados AES-256-GCM)
                    ├─ Grava AuditLog DRIVE_AUTORIZADO
                    └─ Redireciona para /dashboard/configuracoes?drive=conectado
```

### Renovacao de token

`uploadPdfToDrive` (em `src/lib/drive.ts`) verifica `tokenExpiry` antes de cada upload.
Se expirado, chama `oauth2.refreshAccessToken()` e persiste o novo `accessToken` no banco.
Se o refresh falhar (token revogado), retorna `null` e o upload e ignorado com warning.

### Desconexao

```
[Remover Integracao] ──► POST /api/integrations/google-drive/disconnect
    │
    ├─ Deleta DriveCredential do banco
    ├─ Grava AuditLog DRIVE_REVOGADO
    └─ DSFs futuras: concluidas sem upload (warning no frontend)
    
    Arquivos ja salvos no Drive: NAO sao afetados
```

---

## 7. Fluxo de Permissoes por Perfil

| Tela / Acao | Permissao necessaria |
|---|---|
| Buscar paciente | Qualquer autenticado |
| Cadastrar paciente | `CLIENTE_CADASTRAR` |
| Editar dados do paciente | Qualquer autenticado |
| Emitir DSF | `DSF_EMITIR` |
| Cancelar DSF | `DSF_CANCELAR` |
| Configuracoes Drive | `DRIVE_CONFIGURAR` |
| Historico ANVISA | `ANVISA_RELATORIOS` |
| Painel Admin (home) | Qualquer uma das 4 acima |

O `DashboardShell` recebe `permissions[]` via Server Component e exibe apenas os itens de menu pertinentes.

---

## 8. Fluxo de Autenticacao

```
Qualquer rota /dashboard/** sem sessao ──► redirect /auth/login

/auth/login
    │
    └─ Submit (email + senha)
            │
            └─► POST /api/auth/callback/credentials (NextAuth)
                        │
            ┌───────────┼──────────────────────┐
            │ Valido    │ Invalido              │
            ▼           ▼                       ▼
        JWT criado   Credenciais invalidas   (tenant inativo)
        redirect /dashboard
```

- Estrategia: JWT (sem tabela de sessoes no banco)
- Payload do JWT: `id`, `tenantId`, `permissions[]`, `crf?`
- Expirado → NextAuth redireciona para `/auth/login` automaticamente

---

## 9. Cron Job de Limpeza

```
Todo dia as 03:00 UTC (Vercel):

GET /api/cron/cleanup-dsf
Authorization: Bearer {CRON_SECRET}
    │
    ├─ Busca DSFs com status=EMITIDA e updatedAt < agora - 24h
    ├─ Atualiza cada uma: status='CANCELADA'  (Promise.all — sem transacao)
    ├─ Grava AuditLog CRON_CLEANUP_DSF
    └─ Retorna { cancelled: N }
```

Garante que DSFs `EMITIDA` ha mais de 24h (cupom nao digitalizado, atendente abandonou o fluxo) sejam encerradas automaticamente.

---

## 10. Consentimento LGPD

- Checkbox obrigatorio no formulario de cadastro
- `consentimentoLgpdAt` salvo como `DateTime` no momento do cadastro
- Sem marcacao → frontend bloqueia o envio
- Texto exibido ao atendente declara que o paciente consentiu conforme Lei 13.709/2018
