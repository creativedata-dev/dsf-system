# Roadmap de Produto — FarmaSign

Baseado no Plano de Expansao RDC 44/2009.  
Ultima atualizacao: 08/06/2026 — Modulos 1.1, 1.2, 2.1, 2.2, 3.1 e 3.2 entregues.

---

## Status Atual (v1 — Producao)

Funcionalidades entregues e operacionais em `app.farmasign.com.br`:

- [x] Emissao de DSF (11 tipos de servico RDC 44/2009)
- [x] Digitalizacao e upload automatico no Google Drive por tenant
- [x] Impressao termica (80mm) e relatorio clinico (A4)
- [x] Gestao de pacientes (LGPD, historico)
- [x] Relatorio ANVISA com exportacao CSV
- [x] Cancelamento de DSF com motivo e auditoria
- [x] Multi-tenancy com RBAC por usuario
- [x] Configuracao de procedimentos habilitados + textos de orientacao
- [x] Sistema de assinaturas (Trial/Mensal/Anual/Vitalicio)
- [x] Integracao Stripe com webhook
- [x] PWA (instalavel no celular)
- [x] Dashboard SaaS para gestao de assinantes
- [x] Sistema de modulos por tenant (gerenciador super admin + slug por feature)
- [x] Controle de Temperatura e Umidade (Modulo 1.1)
- [x] Gestao de Equipamentos e Calibracao (Modulo 1.2)
- [x] POPs e E-learning hibrido com quiz (Modulo 2.1)
- [x] Controle de Validade e Quarentena (Modulo 3.1)
- [x] Painel do Fiscal com link temporario publico (Modulo 2.2)
- [x] Rastreabilidade de Fracionamento com etiquetas QR Code (Modulo 3.2)

---

## FASE 1 — Seguranca Ambiental e Equipamentos
**Prazo estimado:** 6-8 semanas  
**Impacto:** Critico — item mais cobrado em vistorias da Vigilancia Sanitaria

### 1.1 Controle de Temperatura e Umidade ✅ Entregue

**Por que e critico:**  
A ausencia de registro de termo-higrometria e o motivo numero 1 de autuacao. Exigido para geladeiras de termolabeis, sala de injetaveis e area de dispensacao.

**Requisitos funcionais:**
- Cadastro de ambientes monitorados por tenant (Geladeira A, Balcao, Sala de Injetaveis...)
- Lancamento de leitura (temperatura em °C + umidade % quando aplicavel)
- Dois periodos diarios: Manha e Tarde
- Limites configurados por ambiente (ex: geladeira 2°C a 8°C)
- Alerta automatico quando leitura fora do limite ou omissao do dia
- Grafico de sazonalidade (linha do tempo com bandas de limite)
- Exportacao PDF do historico por periodo (para vistoria)
- Retencao de dados: **minimo 5 anos** (exigencia ANVISA)

**Modelo de dados:**

```prisma
model Ambiente {
  id          String   @id @default(uuid())
  tenantId    String
  nome        String   // "Geladeira de Termolabeis", "Sala de Injetaveis"
  tipo        String   // "GELADEIRA" | "AMBIENTE" | "SALA_ESPECIAL"
  tempMin     Float    // limite inferior em °C
  tempMax     Float    // limite superior em °C
  umidadeMin  Float?   // null para geladeiras
  umidadeMax  Float?
  ativo       Boolean  @default(true)
  createdAt   DateTime @default(now())

  registros RegistroTermoHigrometria[]
  tenant    Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}

model RegistroTermoHigrometria {
  id               String   @id @default(uuid())
  ambienteId       String
  tenantId         String
  dataLeitura      DateTime @db.Date
  periodo          String   // "MANHA" | "TARDE"
  temperaturaGraus Float
  umidadePercent   Float?
  usuarioId        String   // quem registrou
  alertaDisparado  Boolean  @default(false)
  observacao       String?
  createdAt        DateTime @default(now())

  ambiente  Ambiente @relation(fields: [ambienteId], references: [id])

  @@unique([ambienteId, dataLeitura, periodo])
  @@index([tenantId, dataLeitura(sort: Desc)])
}
```

**UX — Lancamento Rapido (Mobile-First):**  
Fluxo de registro em no maximo 3 toques: selecionar ambiente → digitar temperatura → confirmar. Sem necessidade de navegar pelo menu. Atalho na home do dashboard.

**APIs a criar:**
- `GET /api/ambientes` — lista ambientes do tenant
- `POST /api/ambientes` — cadastrar ambiente (DRIVE_CONFIGURAR)
- `POST /api/temperatura` — registrar leitura
- `GET /api/temperatura/historico` — historico com filtros de periodo
- `GET /api/temperatura/export?formato=pdf` — PDF para vistoria

---

### 1.2 Gestao de Equipamentos e Calibracao ✅ Entregue

**Por que e importante:**  
Esfigmomanometro, glicosimetro, termometro e balanca precisam de laudo de calibracao anual. Equipamento sem laudo = multa por equipamento.

**Requisitos funcionais:**
- Cadastro de equipamentos por tenant (nome, marca, modelo, numero de serie)
- Data da ultima e proxima calibracao
- Upload do laudo de calibracao em PDF (Google Drive)
- Status automatico: ATIVO / VENCENDO (30 dias antes) / VENCIDO
- Alerta antecipado de vencimento (email ou notificacao in-app)
- Lista de equipamentos com laudos para impressao (vistoria)

**Modelo de dados:**

```prisma
model Equipamento {
  id                    String   @id @default(uuid())
  tenantId              String
  nome                  String   // "Esfigmomanometro Adulto"
  marcaModelo           String
  numeroSerie           String?
  dataUltimaCalibracao  DateTime @db.Date
  dataProximaCalibracao DateTime @db.Date
  status                String   // "ATIVO" | "VENCENDO" | "VENCIDO" | "MANUTENCAO"
  laudoDriveFileId      String?  // PDF do laudo no Drive
  laudoUrl              String?
  obs                   String?
  ativo                 Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([dataProximaCalibracao])  // cron de alertas
}
```

**Cron adicional:**  
`GET /api/cron/alertas-equipamentos` — diario, marca equipamentos como VENCENDO/VENCIDO e registra alerta.

---

## FASE 2 — Gestao de Qualidade e Documentos
**Prazo estimado:** 8-10 semanas  
**Impacto:** Alto — comprova treinamento de pessoal (exigencia direta da RDC 44/2009)

### 2.1 POPs e E-learning Hibrido ✅ Entregue

**Por que e importante:**  
A RDC exige que todos os funcionarios sejam treinados nos Procedimentos Operacionais Padrao (POPs). Sem evidencia documentada, o fiscal autua mesmo que o treinamento tenha ocorrido.

**O que foi implementado:**
- 10 POPs padrao FarmaSign baseados na RDC 44/2009 (conteudo global, `tenantId = null`)
- Tenants podem sobrepor qualquer POP padrao com conteudo proprio OU adicionar POPs extras
- E-learning hibrido: leitura de conteudo por secoes + quiz de 3 questoes (minimo 2/3 acertos)
- Retry imediato sem cooldown — ciencia registrada apenas na primeira aprovacao
- Registro imutavel: `AssinaturaPOP` com usuario, acertos, respostas, IP de origem e User-Agent
- Visao gerencial: contagem de conclusoes por POP por tenant
- Permissao `POPS_GERENCIAR` para gestao de POPs customizados
- Seed idempotente: `npx tsx prisma/seed-pops.ts`

---

### 2.2 Painel do Fiscal (Dashboard de Vistoria) ✅ Entregue

**Por que e critico para vendas:**  
E o diferencial visivel. O farmaceutico mostra ao fiscal uma unica tela com o resumo de conformidade do tenant.

**O que foi implementado:**
- Tela dedicada em `/dashboard/fiscal` com layout otimizado
- Resumo de conformidade: temperatura, equipamentos, POPs, validade e DSFs
- Cards de status por modulo habilitado
- Modulo `PAINEL_FISCAL` com controle de acesso por tenant

---

## FASE 3 — Operacao de Loja Avancada
**Prazo estimado:** 10-12 semanas  
**Impacto:** Alto (especialmente para lojas com grande volume de medicamentos)

### 3.1 Controle de Validade e Quarentena ✅ Entregue

**O que foi implementado:**
- Catalogo hibrido de produtos: cadastro livre por nome cria entrada automatica no catalogo do tenant para reuso com autocomplete
- Lotes com: numero do lote, fabricante, validade, quantidade + unidade (un/cx/mL/g/mg/L/kg/comp/amp/fr), localizacao fisica, observacoes
- Alertas automaticos em 3 horizontes: VENCENDO_90 (90 dias), VENCENDO_30 (30 dias), VENCIDO
- Fluxo de quarentena com segregacao fisica registrada no sistema
- Auto de Descarte formal: numero do auto, motivo, data, responsavel — registro imutavel
- Cron diario (08h UTC): `GET /api/cron/alertas-validade` registra AuditLog por tenant com contagem por horizonte
- Dashboard com abas Alertas / Quarentena / Todos e modais de acao por lote
- Permissao `VALIDADE_GERENCIAR` para cadastro e fluxo de quarentena/descarte

### 3.2 Rastreabilidade de Fracionamento ✅ Entregue

**Apenas para tenants com fracionamento habilitado.**

**O que foi implementado:**
- Vinculo do fracionamento ao lote original (fabricante, lote, validade) via modelo `FracionamentoLote → LoteProduto`
- Registro de N fracoes por evento com quantidade, unidade e destinacao opcional (`FracaoItem`)
- Geracao de etiqueta PDF 80x50mm com QR Code por fracao (pdf-lib + qrcode) — QR encoda produto, lote, validade, quantidade e numero da fracao
- Timestamp imutavel de impressao por fracao (`etiquetaImpressaEm`)
- API: GET/POST `/api/fracionamento`, PATCH `/api/fracionamento/[id]`, GET `/api/fracionamento/[id]/etiqueta`
- Dashboard `/dashboard/fracionamento` com lista expansivel, modal de registro e impressao individual ou em lote
- Permissao `FRACIONAMENTO_GERENCIAR` e auditoria completa (`FRACAO_CRIADA`, `FRACAO_ATUALIZADA`, `ETIQUETA_IMPRESSA`)
- Modulo `FRACIONAMENTO` com controle de acesso por tenant

---

## Consideracoes Tecnicas para Todas as Fases

### Retencao de Dados (5 anos — Exigencia ANVISA)
Registros de temperatura, equipamentos e treinamentos nao podem ser excluidos antes de 5 anos. Implementar soft-delete com flag `arquivadoEm` e politica de retencao no banco.

### Imutabilidade de Registros
Apos criacao, registros criticos (RegistroTermoHigrometria, AssinaturaPOP) nao podem ser editados — apenas o usuario responsavel e a observacao podem ter correcao posterior rastreada. Toda alteracao gera AuditLog.

### Lancamento Mobile Rapido (Temperatura)
O registro de temperatura ocorre 2x/dia por toda a equipe. UX deve ter:
- Atalho na home do dashboard
- Formulario de uma tela, sem scroll
- Sugestao do ambiente mais recente
- Confirmacao em 1 toque

### Exportacao PDF Estruturada
Os PDFs gerados para vistoria devem ter:
- Cabecalho com dados do estabelecimento e CNPJ
- Periodo coberto
- Assinatura digital do farmaceutico RT
- Numero sequencial e timestamp imutavel
- QR Code para validacao de autenticidade (hash SHA-256 do conteudo)

---

## Matriz de Priorizacao (Consolidada)

| Modulo | Impacto Vistoria | Complexidade | Prioridade | Fase | Status |
|---|---|---|---|---|---|
| Temperatura/Umidade | Altissimo | Baixa | **Critica** | 1 | ✅ Entregue |
| Equipamentos/Calibracao | Alto | Baixa | Alta | 1 | ✅ Entregue |
| POPs e Treinamentos | Alto | Media | Alta | 2 | ✅ Entregue |
| Validade/Quarentena | Altissimo | Media | Alta | 3 | ✅ Entregue |
| Painel do Fiscal | Altissimo | Media | Alta | 2 | ✅ Entregue |
| Fracionamento | Medio | Alta | Media | 3 | ✅ Entregue |

---

## Dependencias e Pre-requisitos Tecnicos

Antes de iniciar a Fase 1:

- [x] Armazenamento de PDFs de laudos — Google Drive por tenant (ja implementado)
- [x] Politica de alertas — in-app apenas (cron diario gera AuditLog)
- [ ] Confirmar retencao 5 anos com Neon (custo de storage)
- [ ] Definir se Painel do Fiscal precisa de link publico (implica rota sem autenticacao com token temporario)

---

## Impacto no Modelo de Negocio

A expansao justifica um novo tier de plano:

```
Plano Conformidade (sugestao)
  ✓ Tudo do Mensal/Anual
  ✓ Controle de Temperatura (Fase 1)
  ✓ Gestao de Equipamentos (Fase 1)
  ✓ POPs e Treinamentos (Fase 2)
  ✓ Painel do Fiscal PDF (Fase 2)
  + Preco premium justificado pelo ROI de multas evitadas
```

Argumento de venda: **"Uma autuacao evitada ja paga o plano Conformidade por 2 anos."**
