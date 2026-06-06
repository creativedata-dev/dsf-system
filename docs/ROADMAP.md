# Roadmap de Produto — FarmaSign

Baseado no Plano de Expansao RDC 44/2009.  
Ultima atualizacao: 06/06/2026.

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

---

## FASE 1 — Seguranca Ambiental e Equipamentos
**Prazo estimado:** 6-8 semanas  
**Impacto:** Critico — item mais cobrado em vistorias da Vigilancia Sanitaria

### 1.1 Controle de Temperatura e Umidade

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

### 1.2 Gestao de Equipamentos e Calibracao

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

### 2.1 Modulo de POPs e Assinatura de Treinamento

**Por que e importante:**  
A RDC exige que todos os funcionarios sejam treinados nos Procedimentos Operacionais Padrao (POPs). Sem evidencia documentada, o fiscal autua mesmo que o treinamento tenha ocorrido.

**Requisitos funcionais:**
- Upload de documentos POP em PDF por tenant
- Versionamento (POP-004 v1.0 → v2.0)
- Lista de funcionarios que precisam assinar cada versao
- Fluxo de assinatura digital: funcionario recebe link, le o documento, clica "Li e Compreendido"
- Registro imutavel com: usuario, data/hora, IP de origem
- Alerta para farmaceutico RT quando funcionario nao assinou em X dias
- Exportacao PDF de evidencias de treinamento por funcionario ou por POP

**Modelo de dados:**

```prisma
model DocumentoPOP {
  id          String   @id @default(uuid())
  tenantId    String
  codigo      String   // "POP-004-SERVICOS"
  nome        String
  versao      String   // "2.0"
  driveFileId String?  // PDF no Drive
  vigente     Boolean  @default(true)
  criadoPorId String
  createdAt   DateTime @default(now())

  assinaturas AssinaturaPOP[]
  tenant      Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, codigo, versao])
  @@index([tenantId])
}

model AssinaturaPOP {
  id           String   @id @default(uuid())
  documentoId  String
  tenantId     String
  usuarioId    String
  dataLeitura  DateTime @default(now())
  aceitouTermos Boolean
  ipOrigem     String
  userAgent    String

  documento DocumentoPOP @relation(fields: [documentoId], references: [id])

  @@unique([documentoId, usuarioId])  // uma assinatura por usuario por versao
  @@index([tenantId])
}
```

---

### 2.2 Painel do Fiscal (Dashboard de Vistoria)

**Por que e critico para vendas:**  
E o diferencial visivel. O farmaceutico mostra ao fiscal uma unica tela, clica "Exportar Pacote de Conformidade" e entrega tudo em PDF.

**Requisitos funcionais:**
- Tela dedicada em `/dashboard/fiscal` com layout otimizado para impressao
- Selecao de periodo (ex: ultimos 30 dias, trimestre, ano)
- Componentes do pacote exportado:
  - Historico completo de registros de temperatura por ambiente
  - Grafico de variacao de temperatura com datas e responsaveis
  - Lista de equipamentos com status de calibracao e laudos em anexo
  - POPs vigentes com lista de assinaturas de todos os funcionarios
  - Historico de DSFs emitidas no periodo (ja existente)
  - Alertas disparados e respectivas correcoes
- Exportacao em PDF unico com QR Code de autenticidade
- Opcao de compartilhamento via link temporario (30 minutos) para o fiscal visualizar sem login

---

## FASE 3 — Operacao de Loja Avancada
**Prazo estimado:** 10-12 semanas  
**Impacto:** Alto (especialmente para lojas com grande volume de medicamentos)

### 3.1 Controle de Validade e Quarentena

**Requisitos funcionais:**
- Cadastro de lotes de produtos com validade
- Alertas automaticos: 90 dias antes do vencimento, 30 dias, dia do vencimento
- Fluxo de quarentena: produto segregado fisicamente, registrado no sistema como QUARENTENA
- Registro de inutilizacao com numero do auto de descarte
- Historico de produtos vencidos (evidencia de controle para vistoria)
- Dashboard de proximos vencimentos

### 3.2 Rastreabilidade de Fracionamento

**Apenas para tenants com fracionamento habilitado.**

**Requisitos funcionais:**
- Vinculo do fracionamento ao lote original (fabricante, lote, validade)
- Geracao de etiqueta impressa com codigo de barras/QR
- Rastreio: embalagem original → fracoes geradas → destinacao

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

| Modulo | Impacto Vistoria | Complexidade | Prioridade | Fase |
|---|---|---|---|---|
| Temperatura/Umidade | Altissimo | Baixa | **Critica** | 1 |
| Equipamentos/Calibracao | Alto | Baixa | Alta | 1 |
| POPs e Treinamentos | Alto | Media | Alta | 2 |
| Painel do Fiscal | Altissimo | Media | Alta | 2 |
| Validade/Quarentena | Altissimo | Media | Alta | 3 |
| Fracionamento | Medio | Media | Media | 3 |

---

## Dependencias e Pre-requisitos Tecnicos

Antes de iniciar a Fase 1:

- [ ] Decidir modelo de armazenamento de PDFs de laudos (Google Drive por tenant ja existe)
- [ ] Definir politica de alertas: in-app apenas ou email tambem (ex: Resend/SendGrid)
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
