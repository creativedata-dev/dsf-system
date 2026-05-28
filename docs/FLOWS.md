# Fluxos de Usuario — DSF System

## 1. Maquina de Estados — Pagina de Emissao DSF

Arquivo: `src/app/dashboard/clientes/page.tsx`

### Estados (Mode)

```
idle                Tela inicial, campo de busca CPF
searching           Aguardando resposta da API de busca
not_found           CPF nao cadastrado — opcoes: cadastrar ou buscar outro
registering         Formulario de novo paciente (preenchimento)
registering_saving  Aguardando POST /api/clients/register
viewing             Ficha do paciente + historico de DSFs
editing             Formulario de edicao de dados do paciente
saving              Aguardando PUT /api/clients/update
emitting            Formulario de emissao de DSF
submitting_dsf      Aguardando POST /api/dsf/create
dsf_generated       Documento gerado — aguarda impressao e assinatura
dsf_scanning        Captura do cupom assinado (camera ou drag & drop)
dsf_uploading       Aguardando POST /api/dsf/upload-signed
dsf_concluida       Tela de conclusao apos upload bem-sucedido
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
regist. idle(novo) editing                  emitting
    │               │                          │
    ▼           ┌───┴──┐                   ┌───┴──┐
reg_saving    saving  viewing           sub_dsf  viewing
    │             │                        │
    ▼             ▼                        ▼
 viewing        viewing               dsf_generated
                                           │
                                ┌──────────┴───────────┐
                                ▼                      ▼
                           window.print()         dsf_scanning
                           (impressao)                 │
                                               ┌───────┴──────────┐
                                               ▼                  ▼
                                         dsf_uploading          viewing
                                               │                (cancel)
                                       ┌───────┴──────────┐
                                       ▼                  ▼
                                  dsf_concluida       dsf_scanning
                                  (tela conclusao)    (erro — retry)
                                       │
                              ┌────────┴────────┐
                              ▼                 ▼
                           viewing            idle
                       (ver cadastro)    (novo atend.)
```

### Variaveis de estado

| Variavel | Tipo | Descricao |
|---|---|---|
| `cpfInput` | string | CPF digitado com mascara |
| `searchedCpf` | string | 11 digitos da ultima busca |
| `cliente` | ClienteData \| null | Dados do paciente encontrado |
| `receiptDsf` | ReceiptDsf \| null | Payload retornado pelo create (impressao + upload) |
| `dsfHistory` | DsfHistoryItem[] | Historico de DSFs do paciente (carregado em paralelo ao viewing) |
| `capturedImage` | string \| null | Data URL da foto/PDF do cupom assinado |
| `isMobile` | boolean | Detectado via `(pointer: coarse)` |

---

## 2. Fluxo de Busca e Atendimento

```
Atendente digita CPF → GET /api/clients/search?cpf={digits}
                              │
              ┌───────────────┼──────────────────────────┐
              │ 200           │ 404                      │ Erro
              ▼               ▼                          ▼
           viewing         not_found                  idle
    + fetch /api/clients/{id}/dsfs (paralelo, sem bloquear UI)
    + exibe historico de DSFs abaixo da ficha
```

O widget `CpfSearch` no home redireciona para `/dashboard/clientes?cpf={digits}`.  
A pagina detecta o query param no mount e dispara a busca automaticamente.

---

## 3. Fluxo Hibrido de Emissao de DSF

### Etapa 1 — Emissao

```
viewing → [Confirmar Dados e Iniciar DSF] → emitting

Formulario: tipo de servico, evolucao farmaceutica, insumos[]

[Emitir DSF] → submitting_dsf → POST /api/dsf/create
                                        │
                     ┌──────────────────┼───────────────┐
                     │ 200              │ 422 (sem RT)  │ Erro
                     ▼                 ▼               ▼
                dsf_generated      dsfError         dsfError
                (status EMITIDA)
```

Layout do documento determinado por `Tenant.tipoImpressao`:
- `BOBINA_80MM` — cupom termico 72mm, `@page { size: 80mm auto }`
- `FOLHA_A4` — relatorio clinico A4 com tabela de insumos e linhas de assinatura

### Etapa 2 — Digitalizacao

```
dsf_generated → [Digitalizar] → dsf_scanning

Captura:
  - Mobile (pointer: coarse): camera traseira com viewfinder
  - Desktop: drag & drop ou selecao de arquivo (JPG, PNG, PDF)

[Enviar e Finalizar] → dsf_uploading → POST /api/dsf/upload-signed
                                               │
                                   ┌───────────┼──────────────┐
                                   │ 200       │ Erro         │
                                   ▼           ▼              ▼
                              dsf_concluida  dsf_scanning  dsf_scanning
```

### O que upload-signed faz

1. Recebe `{ dsfId, fileBase64 }` — imagem (JPEG/PNG) ou PDF (data URL)
2. Se imagem: converte para PDF via pdf-lib (max largura 595pt)
3. Se PDF: usa os bytes diretamente sem conversao
4. Upload para pasta do tenant no Drive via `uploadPdfToDrive()`
5. Atualiza DSF: `status = CONCLUIDA`, `driveFileId`
6. Grava AuditLog `DSF_CONCLUIDA`

### Tela de Conclusao (dsf_concluida)

- Card verde com numero da DSF em destaque
- Resumo: paciente, CPF, servico, RT, data/hora
- Botao "Ver Cadastro do Paciente" → `viewing`
- Botao "Novo Atendimento" → `idle` (limpa todo o estado)

---

## 4. Fluxo de Cancelamento de DSF

```
/dashboard/anvisa (tabela) → [Cancelar] → modal de confirmacao
    │
    └─ [Confirmar] → POST /api/dsf/cancel { dsfId, motivo? }
                            │
                    DSF.status = CANCELADA
                    DSF.observacoes = "[CANCELADA: motivo]"
                    AuditLog DSF_CANCELADA
```

Disponivel para usuarios com `DSF_CANCELAR`. DSF ja cancelada retorna `409`.

---

## 5. Integracao Google Drive

```
/dashboard/configuracoes → [Conectar]
    → GET /api/integrations/google-drive
      (escopos: drive.file + userinfo.email)
    → Consentimento Google
    → GET /api/integrations/google-drive/callback?code=...
        ├─ Troca code por tokens
        ├─ Busca email da conta via getTokenInfo()
        ├─ Cria pasta "DSF System — {tenantNome}" no Drive
        ├─ Salva DriveCredential (tokens AES-256-GCM + driveEmail)
        ├─ AuditLog DRIVE_AUTORIZADO
        └─ redirect ?drive=conectado
```

### Renovacao de token

`uploadPdfToDrive` verifica `tokenExpiry` antes de cada upload. Se expirado, chama `oauth2.refreshAccessToken()` e persiste o novo token. Se o refresh falhar, retorna `null` com warning (DSF concluida sem upload).

### Email da conta

Apos autorizacao, o email da conta Google e salvo em `DriveCredential.driveEmail` e exibido no card do dashboard. Credenciais anteriores ao campo sao preenchidas via backfill lazy na carga do dashboard.

---

## 6. Permissoes por Perfil

| Tela / Acao | Permissao |
|---|---|
| Emissao DSF (balcao) | `CLIENTE_BUSCAR` + `DSF_EMITIR` |
| Cadastrar paciente | `CLIENTE_CADASTRAR` |
| Cancelar DSF | `DSF_CANCELAR` |
| Relatorio DSF / exportar CSV | `ANVISA_RELATORIOS` |
| Clientes (listagem admin) | qualquer permissao admin |
| Configurar Google Drive | `DRIVE_CONFIGURAR` |
| Gestao de Usuarios | qualquer permissao admin |
| Painel Global / Tenants | `SUPER_ADMIN_GLOBAIS` |
| Dashboard (home admin) | qualquer permissao admin |

**Permissoes admin:** `SUPER_ADMIN_GLOBAIS`, `ANVISA_RELATORIOS`, `DSF_CANCELAR`, `DRIVE_CONFIGURAR`

---

## 7. Sidenav por Perfil

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
| Estabelecimentos | `SUPER_ADMIN_GLOBAIS` |

---

## 8. Fluxo de Gestao de Tenants (Super Admin)

```
/dashboard/tenants → tabela de todos os tenants com _count de usuarios e DSFs

[Detalhes] → modal com duas abas:
  │
  ├─ Dados: formulario de edicao (nome, CNPJ, endereco, logo, tipo impressao)
  │         POST /api/admin/tenants (criar)
  │         PATCH /api/admin/tenants/{id} (editar + logo + ativar/desativar)
  │
  └─ Usuarios: listagem dos usuarios do tenant
              GET /api/admin/users?tenantId={id}
              POST /api/admin/users (criar no tenant)
              PATCH /api/admin/users/{id} (editar / ativar / desativar)
```

### Logo do Tenant
- Upload via browser (FileReader + Canvas)
- Redimensionado para max 320x160px, formato WebP, qualidade 0.85
- Salvo como base64 data URL em `Tenant.logoUrl`
- Exibido no sidebar no lugar de "DSF System" quando disponivel
- Exibido no documento DSF impresso

---

## 9. Fluxo de Autenticacao

```
Qualquer rota /dashboard/** sem sessao → redirect /auth/login

/auth/login → POST /api/auth/callback/credentials (NextAuth)
                    │
       ┌────────────┼──────────────────────┐
       │ Valido     │ Invalido             │ Tenant inativo
       ▼            ▼                     ▼
   JWT criado    Credenciais invalidas  Bloqueado
   redirect /dashboard
```

- Estrategia: JWT (sem tabela de sessoes)
- Payload: `id`, `tenantId`, `permissions[]`, `crf?`

---

## 10. Cron Job de Limpeza

```
Todo dia 03:00 UTC:
GET /api/cron/cleanup-dsf
Authorization: Bearer {CRON_SECRET}
    │
    ├─ DSFs status=EMITIDA com updatedAt < agora - 24h
    ├─ status = CANCELADA (Promise.all individual, sem $transaction)
    ├─ AuditLog CRON_CLEANUP_DSF
    └─ { cancelled: N }
```

---

## 11. Restricao Critica — NeonHttp

O adaptador `PrismaNeonHttp` nao suporta transacoes interativas.

**Nunca usar:**
- `prisma.$transaction()`
- `prisma.model.createMany()`
- `prisma.model.updateMany()`

**Sempre usar:** `Promise.all` de operacoes individuais paralelas.
