/**
 * Seed dos 10 POPs padrão FarmaSign baseados na RDC 44/2009.
 * Execute: npx tsx prisma/seed-pops.ts
 *
 * Idempotente: verifica existência pelo código antes de criar.
 * tenantId = null → conteúdo global (padrão FarmaSign).
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env'), override: true })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

interface Opcao {
  letra: string
  texto: string
}

interface Questao {
  ordem: number
  enunciado: string
  opcoes: Opcao[]
  respostaCorreta: string
  justificativa: string
}

interface PopData {
  codigo: string
  titulo: string
  baseLegal: string
  objetivo: string
  conteudo: string
  versao: string
  minAcertos: number
  questoes: Questao[]
}

const POPS: PopData[] = [
  {
    codigo: 'POP-01',
    titulo: 'Dispensação de Medicamentos',
    baseLegal: 'Art. 18, RDC 44/2009',
    objetivo: 'Garantir que a dispensação de medicamentos seja realizada de forma segura, eficiente e com orientação farmacêutica adequada ao paciente, assegurando o uso racional dos medicamentos.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Conceito e Responsabilidade

A dispensação é o ato profissional farmacêutico pelo qual o farmacêutico, a partir da prescrição estabelecida por profissional autorizado, proporciona um ou mais medicamentos ao paciente, geralmente como resultado de uma interpretação correta da prescrição, informando e orientando sobre o seu uso adequado.

O farmacêutico responsável técnico é o responsável legal pelo ato da dispensação. Auxiliares e atendentes somente podem manipular os medicamentos sob supervisão direta do farmacêutico.

### 2. Verificação da Prescrição

Antes de dispensar qualquer medicamento, o atendente deve verificar:

- Identificação do paciente (nome completo)
- Identificação do prescritor (nome, CRM/CRO/COREN e assinatura)
- Denominação do medicamento (DCB ou DCI preferencialmente)
- Posologia (dose, frequência e duração do tratamento)
- Data da prescrição (validade: 30 dias para manipulados, 120 dias para controlados ordinários)
- Quantidade prescrita coerente com o tempo de tratamento

Prescrições com rasuras, ilegíveis ou com dados incompletos devem ser recusadas e o paciente orientado a retornar ao prescritor.

### 3. Etapas da Dispensação

1. Receber a prescrição e verificar todos os itens do checklist de conferência
2. Identificar o medicamento pelo nome, forma farmacêutica e concentração
3. Selecionar o produto no estoque verificando: integridade da embalagem, prazo de validade e lote
4. Registrar a dispensação no sistema (paciente, produto, lote, data)
5. Embalar adequadamente quando necessário
6. Fornecer o medicamento acompanhado de orientação verbal e, quando indicado, escrita

### 4. Orientação ao Paciente e Registro

O farmacêutico ou o atendente (sob supervisão) deve orientar o paciente sobre:

- Como e quando tomar o medicamento
- Duração do tratamento (importância de completar o ciclo)
- Efeitos adversos mais comuns e o que fazer se ocorrerem
- Armazenamento correto em casa
- Interações alimentares ou com outros medicamentos relevantes
- Importância de retornar à farmácia em caso de dúvida

Toda dispensação deve ser registrada no DSF (Documento de Serviço Farmacêutico) conforme exigência da RDC 44/2009, com assinatura do responsável técnico.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Qual profissional é o responsável legal pelo ato da dispensação de medicamentos, conforme a RDC 44/2009?',
        opcoes: [
          { letra: 'a', texto: 'O gerente da farmácia, responsável pela gestão do estabelecimento.' },
          { letra: 'b', texto: 'O farmacêutico responsável técnico, legalmente habilitado para o ato.' },
          { letra: 'c', texto: 'O atendente com maior tempo de serviço no estabelecimento.' },
          { letra: 'd', texto: 'O médico prescritor, que autoriza o uso do medicamento.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'A RDC 44/2009, Art. 18, estabelece que a dispensação é ato profissional do farmacêutico. Auxiliares somente atuam sob supervisão direta.',
      },
      {
        ordem: 2,
        enunciado: 'Uma prescrição com rasuras deve ser:',
        opcoes: [
          { letra: 'a', texto: 'Dispensada normalmente, pois rasuras são comuns em prescrições manuscritas.' },
          { letra: 'b', texto: 'Recusada e o paciente orientado a retornar ao prescritor para uma nova prescrição.' },
          { letra: 'c', texto: 'Aceita desde que o farmacêutico consiga interpretar a medicação prescrita.' },
          { letra: 'd', texto: 'Dispensada após carimbo do farmacêutico sobre a rasura.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'Prescrições com rasuras comprometem a segurança do ato. A conduta correta é recusar e orientar o paciente a obter nova prescrição sem rasuras.',
      },
      {
        ordem: 3,
        enunciado: 'Ao selecionar o produto no estoque, o atendente DEVE verificar obrigatoriamente:',
        opcoes: [
          { letra: 'a', texto: 'Apenas o nome do medicamento e a apresentação.' },
          { letra: 'b', texto: 'O preço de venda e a margem de lucro do produto.' },
          { letra: 'c', texto: 'Integridade da embalagem, prazo de validade e número de lote.' },
          { letra: 'd', texto: 'A marca do fabricante preferida pelo paciente.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A verificação de embalagem, validade e lote é obrigatória para garantir a qualidade e rastreabilidade do medicamento dispensado, conforme exigência de registro nos DSFs.',
      },
    ],
  },

  {
    codigo: 'POP-02',
    titulo: 'Dispensação de Antimicrobianos',
    baseLegal: 'Art. 18, RDC 44/2009 c/c RDC 20/2011',
    objetivo: 'Estabelecer os procedimentos específicos para a dispensação de antimicrobianos sujeitos à prescrição e retenção de receita, conforme legislação vigente, contribuindo para o uso racional e prevenção da resistência bacteriana.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Base Legal e Importância

Antimicrobianos somente podem ser dispensados mediante receita médica ou odontológica em duas vias. A RDC 20/2011 regulamenta o controle de antimicrobianos e estabelece as obrigações dos estabelecimentos farmacêuticos.

A venda sem receita é crime sanitário, passível de interdição do estabelecimento e cancelamento do alvará. O uso inadequado de antimicrobianos é a principal causa de resistência bacteriana — um problema de saúde pública global.

### 2. Verificação Específica da Prescrição

Além dos itens gerais de toda dispensação, verificar:

- Prescrição em duas vias (obrigatório pela RDC 20/2011)
- Data de validade (prescrição válida por 10 dias)
- CRM/CRO/COREN legível e com data de validade
- Quantidade prescrita compatível com o tempo de tratamento
- Via de administração claramente especificada

### 3. Procedimento de Retenção

1. Reter a 1ª via da receita e devolver a 2ª via ao paciente (carimbada)
2. Preencher o verso da 1ª via com dados obrigatórios:
   - Nome do comprador e CPF
   - Endereço completo
   - Data da dispensação
3. Arquivar a receita retida por **2 anos** em ordem cronológica
4. Registrar no sistema: prescritor, CRM/CRO, data, antimicrobiano, lote e quantidade

### 4. Orientação ao Paciente

- Enfatizar que o ciclo DEVE ser completado mesmo com melhora dos sintomas
- Alertar que antimicrobianos não tratam infecções virais (resfriado, gripe)
- Orientar sobre possíveis interações (ex.: ciprofloxacino + antiácidos)
- Esclarecer que sobras nunca devem ser guardadas para uso futuro
- Informar sobre o descarte correto em coletores de medicamentos`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Conforme a RDC 20/2011, quantas vias deve ter a receita para dispensação de antimicrobianos?',
        opcoes: [
          { letra: 'a', texto: 'Uma via, que é retida pela farmácia.' },
          { letra: 'b', texto: 'Duas vias: a 1ª retida pela farmácia e a 2ª devolvida ao paciente.' },
          { letra: 'c', texto: 'Três vias: farmácia, paciente e prescritor.' },
          { letra: 'd', texto: 'Pode ser dispensado sem receita mediante assinatura do paciente.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'A RDC 20/2011 exige prescrição em duas vias. A farmácia retém a 1ª via (carimbada) e devolve a 2ª ao paciente como comprovante.',
      },
      {
        ordem: 2,
        enunciado: 'Por quanto tempo as receitas de antimicrobianos devem ser arquivadas na farmácia?',
        opcoes: [
          { letra: 'a', texto: '6 meses após a dispensação.' },
          { letra: 'b', texto: '1 ano a partir da data da dispensação.' },
          { letra: 'c', texto: '2 anos a partir da data da dispensação.' },
          { letra: 'd', texto: '5 anos, seguindo a regra geral de retenção de documentos ANVISA.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A RDC 20/2011 determina que as receitas retidas de antimicrobianos devem ser arquivadas por 2 anos em ordem cronológica, disponíveis para fiscalização a qualquer momento.',
      },
      {
        ordem: 3,
        enunciado: 'Qual a orientação CORRETA a ser dada ao paciente sobre a importância de completar o ciclo do antimicrobiano?',
        opcoes: [
          { letra: 'a', texto: 'O medicamento pode ser suspenso assim que os sintomas desaparecerem.' },
          { letra: 'b', texto: 'A dose pode ser reduzida pela metade ao melhorar, para poupar o medicamento.' },
          { letra: 'c', texto: 'O ciclo deve ser completado mesmo com melhora dos sintomas, para erradicar completamente a bactéria e evitar resistência.' },
          { letra: 'd', texto: 'As sobras podem ser guardadas para a próxima vez que precisar do mesmo antibiótico.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A interrupção precoce do antimicrobiano não elimina completamente as bactérias, favorecendo a sobrevivência de cepas resistentes — principal causa de resistência bacteriana.',
      },
    ],
  },

  {
    codigo: 'POP-03',
    titulo: 'Dispensação de Medicamentos Controlados',
    baseLegal: 'Art. 18, RDC 44/2009 c/c Portaria SVS 344/1998',
    objetivo: 'Regulamentar a dispensação de medicamentos sujeitos a controle especial (psicotrópicos, entorpecentes e outras substâncias), garantindo o cumprimento da legislação sanitária e a segurança do paciente.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Classificação dos Medicamentos Controlados

A Portaria SVS 344/1998 classifica as substâncias sujeitas a controle especial em listas:

- **A1 e A2**: Entorpecentes (morfina, codeína) — receituário especial amarelo, 1 via
- **A3**: Psicotrópicas (benzodiazepínicos) — receituário especial amarelo, 2 vias
- **B1**: Psicotrópicas (ansiolíticos, antidepressivos) — notificação de receita azul
- **B2**: Psicotrópicas anorexígenas — notificação de receita amarela
- **C1**: Outras substâncias sujeitas a controle especial

Cada lista possui receituário, quantidade e prazo de validade específicos.

### 2. Verificação da Receita

Além das verificações gerais, confirmar:

- Tipo de receituário correto para a lista do medicamento
- Número de registro do receituário (notificação de receita)
- Validade da receita (30 dias para Lista C1, 6 meses para Lista B)
- Quantidade máxima permitida (geralmente 60 dias de tratamento)
- Assinatura e carimbo do prescritor com CRM legível

### 3. Procedimento de Dispensação

1. Verificar identidade do comprador (RG ou documento com foto obrigatório)
2. Preencher o verso da receita com: nome, CPF e endereço do comprador, data e quantidade dispensada
3. Reter a receita (toda ela para listas A; 1ª via para Lista B)
4. Registrar no Livro de Registro Especial (para listas A e B2) ou no sistema informatizado
5. Arquivar receitas por **5 anos** (listas A e B), classificadas por mês

### 4. Situações Especiais e Recusas

Situações que impedem a dispensação:
- Receituário incorreto para a substância
- Quantidade superior à permitida
- Receita com prazo de validade vencido
- Impossibilidade de identificar o comprador
- Sinais de adulteração no documento

Em caso de suspeita de adulteração, reter o documento e comunicar imediatamente ao farmacêutico RT.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Medicamentos da Lista B1 (psicotrópicos como benzodiazepínicos) exigem qual tipo de receituário?',
        opcoes: [
          { letra: 'a', texto: 'Receita simples, pois não são entorpecentes.' },
          { letra: 'b', texto: 'Receituário amarelo, igual aos entorpecentes da Lista A.' },
          { letra: 'c', texto: 'Notificação de Receita Azul (modelo B), numerada e com data de validade de 6 meses.' },
          { letra: 'd', texto: 'Notificação de Receita Amarela (modelo B2), utilizada para anorexígenos.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A Lista B1 da Portaria 344/1998 exige Notificação de Receita Azul (modelo B), com numeração impressa e validade de 6 meses a partir da data de emissão.',
      },
      {
        ordem: 2,
        enunciado: 'Por quanto tempo as receitas de medicamentos das Listas A e B devem ser arquivadas na farmácia?',
        opcoes: [
          { letra: 'a', texto: '1 ano.' },
          { letra: 'b', texto: '2 anos.' },
          { letra: 'c', texto: '5 anos.' },
          { letra: 'd', texto: '10 anos.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A Portaria SVS 344/1998 determina que receitas de substâncias das Listas A e B devem ser arquivadas por 5 anos, disponíveis para fiscalização da Vigilância Sanitária.',
      },
      {
        ordem: 3,
        enunciado: 'Ao receber uma receita de controlado com sinais de adulteração (rasuras suspeitas, numeração irregular), o atendente deve:',
        opcoes: [
          { letra: 'a', texto: 'Dispensar normalmente, pois não é papel do atendente julgar a autenticidade da receita.' },
          { letra: 'b', texto: 'Reter o documento e comunicar imediatamente ao farmacêutico responsável técnico.' },
          { letra: 'c', texto: 'Devolver ao paciente e solicitar que regularize com o médico.' },
          { letra: 'd', texto: 'Aceitar apenas se o paciente apresentar documento de identidade.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'Suspeita de adulteração de receita é crime. O procedimento correto é reter o documento e comunicar ao farmacêutico RT imediatamente, que tomará as providências cabíveis.',
      },
    ],
  },

  {
    codigo: 'POP-04',
    titulo: 'Aferição de Pressão Arterial',
    baseLegal: 'Art. 24, I, RDC 44/2009',
    objetivo: 'Estabelecer o procedimento correto para aferição da pressão arterial no contexto farmacêutico, garantindo a precisão dos resultados, o registro adequado e a orientação farmacêutica ao paciente.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Indicações e Contraindicações

A aferição de pressão arterial na farmácia é um serviço de saúde previsto na RDC 44/2009 e representa uma importante ação de rastreamento de hipertensão arterial sistêmica (HAS).

**Indicações:** rastreamento populacional, monitoramento de pacientes em tratamento, avaliação de sintomas como cefaleia, tontura e mal-estar.

**Contraindicações temporárias:** exercício físico intenso nos últimos 30 minutos, tabagismo recente (30 min), consumo de cafeína ou álcool recente, bexiga cheia, dor ou ansiedade intensa.

### 2. Equipamentos e Calibração

Utilizar esfigmomanômetro e estetoscópio calibrados. O equipamento deve ter laudo de calibração vigente (máximo 12 meses). Esfigmomanômetros digitais de braço validados são aceitos.

Verificar antes de cada uso: manguito íntegro (sem vazamentos), manômetro zerando corretamente, tubos sem dobras.

### 3. Técnica de Aferição

1. Solicitar que o paciente fique sentado em repouso por pelo menos **5 minutos**
2. Posicionar o braço apoiado na altura do coração, palma virada para cima
3. Selecionar o tamanho correto do manguito (a bolsa inflável deve circundar 80% do braço)
4. Posicionar o manguito 2-3 cm acima da fossa antecubital
5. Palpar a artéria braquial e posicionar o estetoscópio (método auscultatório) ou fixar o sensor (digital)
6. Inflar até 30 mmHg acima da pressão estimada por palpação
7. Desinflar lentamente (2-3 mmHg/s)
8. Registrar: 1ª fase de Korotkoff = sistólica; 5ª fase (silêncio) = diastólica
9. Aguardar 1-2 minutos e realizar segunda medição

### 4. Registro, Valores de Referência e Conduta

Registrar no DSF: data, hora, braço utilizado, valores (PAS/PAD), FC se equipamento digital, nome do operador.

| Classificação | PAS (mmHg) | PAD (mmHg) |
|---|---|---|
| Ótima | < 120 | < 80 |
| Normal | 120–129 | 80–84 |
| Limítrofe | 130–139 | 85–89 |
| HAS Estágio 1 | 140–159 | 90–99 |
| HAS Estágio 2 | 160–179 | 100–109 |
| HAS Estágio 3 | ≥ 180 | ≥ 110 |
| Crise Hipertensiva | ≥ 180 e/ou | ≥ 120 |

Em casos de HAS Estágio 2/3 ou crise hipertensiva, orientar encaminhamento imediato ao pronto-atendimento.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Por quanto tempo o paciente deve permanecer sentado em repouso ANTES da aferição da pressão arterial?',
        opcoes: [
          { letra: 'a', texto: '1 minuto é suficiente para estabilizar a pressão.' },
          { letra: 'b', texto: '2 minutos, conforme orientação padrão.' },
          { letra: 'c', texto: 'Pelo menos 5 minutos, para garantir a estabilidade hemodinâmica.' },
          { letra: 'd', texto: '10 minutos é o tempo mínimo recomendado.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'As diretrizes de hipertensão recomendam pelo menos 5 minutos de repouso sentado antes da aferição para evitar resultados falsamente elevados por atividade recente.',
      },
      {
        ordem: 2,
        enunciado: 'O esfigmomanômetro utilizado para aferição de pressão arterial na farmácia deve ter laudo de calibração com validade máxima de:',
        opcoes: [
          { letra: 'a', texto: '6 meses.' },
          { letra: 'b', texto: '24 meses.' },
          { letra: 'c', texto: '36 meses.' },
          { letra: 'd', texto: '12 meses.' },
        ],
        respostaCorreta: 'd',
        justificativa: 'O laudo de calibração do esfigmomanômetro deve ter no máximo 12 meses de validade. Equipamentos fora do prazo não devem ser utilizados para aferições clínicas.',
      },
      {
        ordem: 3,
        enunciado: 'Um paciente apresenta pressão arterial de 175/105 mmHg. A conduta correta do farmacêutico é:',
        opcoes: [
          { letra: 'a', texto: 'Repetir a aferição em 30 minutos e aguardar normalização.' },
          { letra: 'b', texto: 'Orientar o encaminhamento ao médico para avaliação de HAS Estágio 2 e registrar no DSF.' },
          { letra: 'c', texto: 'Dispensar anti-hipertensivo de venda livre para o paciente.' },
          { letra: 'd', texto: 'Ignorar, pois o valor pode estar elevado por ansiedade do ambiente.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'PA 175/105 classifica como HAS Estágio 2. A conduta correta é orientar avaliação médica, registrar no DSF e, se necessário, encaminhar ao pronto-atendimento. Jamais dispensar anti-hipertensivo sem receita.',
      },
    ],
  },

  {
    codigo: 'POP-05',
    titulo: 'Aferição de Glicemia Capilar',
    baseLegal: 'Art. 24, II, RDC 44/2009',
    objetivo: 'Padronizar o procedimento de aferição de glicemia capilar na farmácia, assegurando a segurança do paciente, a biossegurança do profissional e a precisão dos resultados obtidos.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Indicações e Preparo do Paciente

A glicemia capilar na farmácia é indicada para rastreamento de diabetes, monitoramento de pacientes em tratamento e avaliação de sintomas sugestivos de hipoglicemia ou hiperglicemia.

**Preparo:** para glicemia de jejum, o paciente deve estar em jejum de pelo menos 8 horas. Para glicemia pós-prandial, colher 2 horas após a refeição principal e registrar o horário da última refeição.

**Contraindicações:** hemoglobinemia, hipotermia grave, choque circulatório — nestas situações, o resultado pode não ser confiável.

### 2. Equipamentos e Biossegurança

**Materiais necessários:** glicosímetro calibrado e com controle de qualidade vigente, tiras reativas dentro do prazo de validade e corretas para o modelo do aparelho, lancetas descartáveis (uso único), algodão ou gaze, luvas de procedimento.

**Biossegurança obrigatória:**
- Utilizar luvas descartáveis (para o profissional)
- Nunca reutilizar lancetas
- Descartar lancetas em coletor perfurocortante (nunca em lixo comum)
- Higienizar as mãos antes e após o procedimento

### 3. Técnica de Coleta

1. Higienizar as mãos do paciente com água e sabão (não usar álcool gel — interfere na leitura)
2. Calçar luvas de procedimento
3. Inserir a tira reativa no glicosímetro e aguardar sinalização de pronto
4. Realizar punção na lateral da polpa digital (evitar a ponta — mais dolorosa e menos vascularizada)
5. Descartar a primeira gota de sangue (pode conter linfa e falsear o resultado)
6. Aproximar a tira reativa à segunda gota de sangue até preenchimento completo do campo
7. Aguardar o resultado (geralmente 5-10 segundos)
8. Comprimir o local com algodão seco até hemostasia

### 4. Interpretação e Conduta

| Situação | Resultado | Conduta |
|---|---|---|
| Jejum — Normal | 70–99 mg/dL | Orientação e registro |
| Jejum — Pré-diabetes | 100–125 mg/dL | Encaminhar para avaliação médica |
| Jejum — Diabetes | ≥ 126 mg/dL | Encaminhar com urgência |
| Pós-prandial — Normal | < 140 mg/dL | Orientação e registro |
| Pós-prandial — Pré-diabetes | 140–199 mg/dL | Encaminhar para avaliação |
| Pós-prandial — Diabetes | ≥ 200 mg/dL | Encaminhar com urgência |
| Hipoglicemia | < 70 mg/dL | Oferecer açúcar, monitorar e encaminhar |

Registrar no DSF: data, hora, tipo (jejum/pós-prandial), resultado em mg/dL e conduta adotada.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Por que a primeira gota de sangue obtida após a punção deve ser descartada?',
        opcoes: [
          { letra: 'a', texto: 'Por questões estéticas, para que a tira não fique com resíduo de sangue.' },
          { letra: 'b', texto: 'Porque pode conter linfa do tecido e falsear o resultado da glicemia.' },
          { letra: 'c', texto: 'Para garantir que o fluxo de sangue esteja adequado para coleta.' },
          { letra: 'd', texto: 'Não é necessário descartar a primeira gota — pode ser usada normalmente.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'A primeira gota pode ser diluída por linfa tecidual liberada com a punção, resultando em leitura falsamente baixa da glicose. A segunda gota fornece amostra mais representativa.',
      },
      {
        ordem: 2,
        enunciado: 'Qual produto deve ser utilizado para higienizar as mãos do paciente ANTES da aferição de glicemia capilar?',
        opcoes: [
          { letra: 'a', texto: 'Álcool gel 70%, por ser mais prático e disponível no balcão.' },
          { letra: 'b', texto: 'Álcool iodado, pelo poder de antissepsia.' },
          { letra: 'c', texto: 'Água e sabão neutro, pois o álcool interfere na leitura da glicose.' },
          { letra: 'd', texto: 'Não é necessário higienizar as mãos para uma punção rápida.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'O álcool (gel ou líquido) pode interferir na reação enzimática da tira reativa e alterar o resultado. A higienização deve ser feita com água e sabão, seguida de secagem completa.',
      },
      {
        ordem: 3,
        enunciado: 'Um paciente em jejum apresenta glicemia de 118 mg/dL. Qual a classificação correta e a conduta adequada?',
        opcoes: [
          { letra: 'a', texto: 'Normal — apenas orientar manter hábitos saudáveis.' },
          { letra: 'b', texto: 'Diabetes confirmado — encaminhar imediatamente ao pronto-atendimento.' },
          { letra: 'c', texto: 'Pré-diabetes (100–125 mg/dL) — orientar e encaminhar para avaliação médica.' },
          { letra: 'd', texto: 'Hipoglicemia — oferecer açúcar e monitorar.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'Glicemia de jejum entre 100 e 125 mg/dL caracteriza pré-diabetes. A conduta é registrar no DSF, orientar mudanças de estilo de vida e encaminhar para avaliação médica.',
      },
    ],
  },

  {
    codigo: 'POP-06',
    titulo: 'Aplicação de Medicamentos Injetáveis',
    baseLegal: 'Art. 24, III, RDC 44/2009',
    objetivo: 'Padronizar o procedimento de aplicação de medicamentos injetáveis por via intramuscular e subcutânea na farmácia, garantindo a técnica asséptica, a segurança do paciente e a biossegurança do profissional.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Competências e Requisitos

A aplicação de injetáveis na farmácia é serviço privativo do farmacêutico ou do técnico de enfermagem, sob supervisão do farmacêutico RT. Atendentes sem formação técnica não estão haborizados a realizar esse procedimento.

Requisitos para o serviço:
- Farmacêutico RT presente no momento da aplicação
- Sala de procedimentos com maca/cadeira, iluminação adequada e kit de emergência acessível
- Registro no DSF com dados completos do medicamento aplicado

### 2. Material Necessário e Preparo

**Material:** seringa e agulha descartáveis, algodão e álcool 70%, luvas de procedimento, bandeja limpa, prescrição médica, coletor perfurocortante.

**Verificações obrigatórias antes da aplicação:**
- 5 Certos: Paciente certo, Medicamento certo, Dose certa, Via certa, Horário certo
- Integridade do frasco (sem trincas, precipitados ou turvação)
- Validade do medicamento
- Diluente correto (quando aplicável) e compatibilidade
- Alergias do paciente (perguntar ativamente)

### 3. Técnica de Aplicação

**Via Intramuscular (IM):**
1. Higienizar as mãos e calçar luvas
2. Identificar o músculo correto: deltóide (adultos, volume ≤ 1 mL), glúteo ventroglúteo (> 1 mL), vasto lateral (crianças)
3. Limpar o local com algodão embebido em álcool 70% com movimento circular, aguardar secar
4. Introduzir a agulha em ângulo de 90° com movimento firme e único
5. Aspirar levemente — se houver sangue, retirar e trocar de local
6. Injetar lentamente (1 mL a cada 10 segundos)
7. Retirar a agulha no mesmo ângulo, comprimir com algodão seco por 30 segundos

**Via Subcutânea (SC):**
- Ângulo de 45° (adultos com tecido subcutâneo normal) ou 90° (obesos)
- Locais: abdômen, face externa da coxa, parte posterior do braço

### 4. Pós-Procedimento e Reações Adversas

Manter o paciente em observação por **30 minutos** após a aplicação para vigilância de reações adversas (dor, hematoma, reação alérgica, anafilaxia).

**Sinais de anafilaxia:** urticária, broncoespasmo, hipotensão, perda de consciência. Conduta: deitar o paciente, elevar os membros inferiores, ligar 192/SAMU, aplicar epinefrina do kit de emergência se farmacêutico habilitado.

Descartar seringa e agulha **sem reencapar** diretamente no coletor perfurocortante.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'A aplicação de medicamentos injetáveis na farmácia pode ser realizada por:',
        opcoes: [
          { letra: 'a', texto: 'Qualquer funcionário treinado pelo farmacêutico, sem necessidade de formação específica.' },
          { letra: 'b', texto: 'Apenas o farmacêutico RT, sem possibilidade de delegação.' },
          { letra: 'c', texto: 'Farmacêutico ou técnico de enfermagem, sob supervisão do farmacêutico RT presente no local.' },
          { letra: 'd', texto: 'O paciente pode aplicar sozinho, com orientação do atendente.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A RDC 44/2009 permite a aplicação por farmacêutico ou técnico de enfermagem com supervisão do farmacêutico RT. Atendentes sem formação técnica não estão autorizados.',
      },
      {
        ordem: 2,
        enunciado: 'Por quanto tempo o paciente deve ser mantido em observação após a aplicação de um injetável?',
        opcoes: [
          { letra: 'a', texto: '5 minutos — suficiente para verificar reações imediatas.' },
          { letra: 'b', texto: '15 minutos — padrão para vacinas.' },
          { letra: 'c', texto: '30 minutos — para vigilância de reações adversas tardias, incluindo anafilaxia.' },
          { letra: 'd', texto: 'Não é necessário aguardar — o paciente pode sair imediatamente.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'O período de observação de 30 minutos é fundamental para detectar reações adversas, incluindo anafilaxia, que pode manifestar-se até 30 minutos após a aplicação.',
      },
      {
        ordem: 3,
        enunciado: 'Após a aplicação do injetável, como deve ser descartada a seringa com agulha?',
        opcoes: [
          { letra: 'a', texto: 'Reencapar a agulha com a tampa original antes de descartar, por segurança.' },
          { letra: 'b', texto: 'Separar a agulha da seringa e descartar em lixo comum.' },
          { letra: 'c', texto: 'Descartar seringa e agulha SEM reencapar, diretamente no coletor perfurocortante.' },
          { letra: 'd', texto: 'Guardar para descarte coletivo ao final do dia.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'Reencapar agulhas é a principal causa de acidente perfurocortante em saúde. O descarte deve ser imediato, sem reencapar, diretamente no coletor adequado (caixa amarela ou similar).',
      },
    ],
  },

  {
    codigo: 'POP-07',
    titulo: 'Inalação e Nebulização',
    baseLegal: 'Art. 24, IV, RDC 44/2009',
    objetivo: 'Padronizar a realização de inalação e nebulização na farmácia, garantindo a correta preparação do medicamento, a higienização adequada do equipamento e a orientação do paciente para uso eficaz do tratamento.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Indicações e Serviço

Inalação e nebulização são serviços farmacêuticos indicados para pacientes com doenças respiratórias (asma, DPOC, bronquiolite, laringite) que necessitam de administração local de broncodilatadores, corticosteroides ou mucolíticos.

O serviço requer:
- Prescrição médica válida com medicamento, dose e número de sessões
- Farmacêutico RT presente ou atendente supervisionado
- Sala ventilada, preferencialmente com ventilação para o exterior

### 2. Equipamentos e Higienização

**Nebulizador a ar comprimido (jet):** preferencial para a farmácia. Nebulizadores ultrassônicos não são recomendados para soluções com proteínas (insulina, DNase).

**Higienização obrigatória do equipamento entre pacientes:**
1. Desmontar todas as peças em contato com o paciente (máscara/bocal, câmara, tubo)
2. Lavar com água e detergente neutro
3. Enxaguar com água corrente filtrada
4. Imersão em solução de hipoclorito de sódio 1% por 30 minutos
5. Enxaguar com água estéril ou destilada
6. Secar em ambiente limpo ou com ar filtrado

Nunca compartilhar máscaras ou bocais entre pacientes.

### 3. Preparação e Técnica

**Preparo da solução:**
- Aspirar o medicamento conforme prescrição com seringa descartável
- Adicionar soro fisiológico 0,9% para completar volume de 3-5 mL (volume abaixo de 3 mL gera aerossol inadequado)
- Verter na câmara do nebulizador na posição vertical
- Conectar o tubo ao compressor e regular o fluxo (geralmente 6-8 L/min)

**Técnica de inalação:**
- Paciente sentado, levemente inclinado para frente
- Respiração lenta e profunda pela boca (bocal) ou pelo nariz/boca (máscara)
- Pausa de 2-3 segundos no final da inspiração
- Duração: 10-15 minutos ou até câmara vazia

### 4. Orientações ao Paciente e Registro

Orientar o paciente sobre:
- Lavar as mãos antes de manusear os equipamentos em casa
- Higienizar a máscara/câmara após cada uso domiciliar
- Armazenar as soluções corretamente (geladeira quando indicado)
- Nunca misturar medicamentos sem orientação farmacêutica

Registrar no DSF: medicamento, dose, diluente, tempo de nebulização, resposta clínica e orientações fornecidas.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Qual é o volume mínimo de solução recomendado na câmara de nebulização para garantir aerossol adequado?',
        opcoes: [
          { letra: 'a', texto: '1 mL — o volume do medicamento puro já é suficiente.' },
          { letra: 'b', texto: '3 mL — volumes abaixo disso geram aerossol inadequado e perda de medicamento.' },
          { letra: 'c', texto: '10 mL — volume padrão para garantir 15 minutos de nebulização.' },
          { letra: 'd', texto: 'Não há volume mínimo — depende exclusivamente do medicamento prescrito.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'O volume mínimo de 3 mL na câmara é necessário para que o nebulizador gere um aerossol de partículas com tamanho adequado para deposição nas vias aéreas.',
      },
      {
        ordem: 2,
        enunciado: 'Após cada paciente, as peças do nebulizador em contato com o paciente devem ser higienizadas com:',
        opcoes: [
          { letra: 'a', texto: 'Apenas álcool 70% passado rapidamente na máscara.' },
          { letra: 'b', texto: 'Lavagem com água e detergente, seguida de imersão em hipoclorito 1% por 30 minutos e enxágue com água estéril.' },
          { letra: 'c', texto: 'Autoclave imediata de todas as peças após cada uso.' },
          { letra: 'd', texto: 'Substituição da máscara apenas quando visualmente suja.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'O protocolo completo de higienização — lavagem, desinfecção com hipoclorito 1% por 30 minutos e enxágue com água estéril — é obrigatório entre cada paciente para evitar contaminação cruzada.',
      },
      {
        ordem: 3,
        enunciado: 'Durante a nebulização, qual é a postura e técnica respiratória correta para o paciente?',
        opcoes: [
          { letra: 'a', texto: 'Deitado de costas, respirando normalmente pela boca.' },
          { letra: 'b', texto: 'Sentado, levemente inclinado para frente, com respiração lenta e profunda e pausa de 2-3 segundos no final da inspiração.' },
          { letra: 'c', texto: 'Em pé, com respirações rápidas e curtas para maximizar a absorção.' },
          { letra: 'd', texto: 'A postura não interfere na eficácia da nebulização.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'A posição sentada com leve inclinação anterior otimiza a expansão pulmonar. A respiração lenta e profunda com pausa inspiratória aumenta a deposição do aerossol nas vias aéreas inferiores.',
      },
    ],
  },

  {
    codigo: 'POP-08',
    titulo: 'Perfuração de Lóbulo Auricular',
    baseLegal: 'Art. 24, V, RDC 44/2009',
    objetivo: 'Estabelecer o procedimento correto e seguro para perfuração do lóbulo auricular na farmácia, garantindo a antissepsia adequada, o uso de materiais estéreis e as orientações pós-procedimento para prevenção de infecções.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Requisitos Legais e Responsabilidade

A perfuração de lóbulo auricular é serviço de saúde previsto na RDC 44/2009 e somente pode ser realizado na farmácia quando o farmacêutico RT está presente e responsável pelo procedimento.

**Documentação obrigatória:**
- Termo de consentimento informado assinado pelo paciente (ou responsável legal, se menor de 18 anos)
- Para menores: presença do responsável legal durante o procedimento
- Registro completo no DSF

### 2. Material e Área de Procedimento

**Materiais necessários:**
- Pistola de perfuração com cartucho descartável e estéril (uso único)
- Brincos hipoalergênicos estéreis (aço cirúrgico, titânio ou ouro 18k) — nunca metal banhado
- Antisséptico tópico (álcool 70% ou PVPI degermante)
- Luvas de procedimento estéreis
- Caneta marcadora para assepsia
- Gaze estéril

**Área de procedimento:** superfície limpa com papel descartável, iluminação adequada, acesso ao kit de emergência.

### 3. Técnica do Procedimento

1. Higienizar as mãos e calçar luvas estéreis
2. Limpar o lóbulo com algodão e antisséptico em movimento circular, de dentro para fora
3. Marcar o ponto de perfuração com caneta marcadora (verificar simetria bilateral)
4. Mostrar a marcação ao paciente/responsável para aprovação
5. Posicionar o cartucho estéril na pistola
6. Posicionar a pistola perpendicularmente ao lóbulo no ponto marcado
7. Acionar o gatilho com movimento firme e único
8. Verificar o posicionamento do brinco e o fechamento do fecho
9. Limpar o local com gaze e antisséptico

### 4. Cuidados Pós-Procedimento

Orientar verbalmente e por escrito:
- Girar o brinco 2-3 vezes ao dia com as mãos lavadas
- Limpar o lóbulo com álcool 70% 2x/dia (manhã e noite) por 6 semanas
- Não trocar o brinco antes de 6-8 semanas (cicatrização completa)
- Evitar piscinas, praias e saunas nas primeiras 2 semanas
- Sinais de infecção que exigem avaliação médica: vermelhidão intensa, calor, pus, dor progressiva

Registrar no DSF: data, tipo de brinco utilizado, lote do material, observações e orientações fornecidas.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Para realizar a perfuração de lóbulo auricular em um paciente menor de 18 anos, é obrigatório:',
        opcoes: [
          { letra: 'a', texto: 'Apenas que o menor concorde com o procedimento.' },
          { letra: 'b', texto: 'Apenas que um adulto conhecido acompanhe o menor.' },
          { letra: 'c', texto: 'A presença e assinatura do responsável legal no termo de consentimento informado.' },
          { letra: 'd', texto: 'Autorização por escrito do médico pediatra do menor.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A legislação exige consentimento informado do responsável legal para procedimentos em menores de 18 anos. O responsável deve estar presente durante o procedimento e assinar o termo.',
      },
      {
        ordem: 2,
        enunciado: 'Qual tipo de brinco deve ser utilizado para a perfuração inicial do lóbulo auricular?',
        opcoes: [
          { letra: 'a', texto: 'Brinco dourado banhado a ouro — mais higiênico e acessível.' },
          { letra: 'b', texto: 'Qualquer brinco estéril, independentemente do material.' },
          { letra: 'c', texto: 'Brinco hipoalergênico estéril de aço cirúrgico, titânio ou ouro 18k — nunca metal banhado.' },
          { letra: 'd', texto: 'O paciente pode trazer o brinco de sua preferência para ser esterilizado antes do procedimento.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'Metais banhados liberam níquel e outros metais na cicatriz exposta, causando reações alérgicas. Somente aço cirúrgico, titânio ou ouro maciço 18k são biocompatíveis para perfuração inicial.',
      },
      {
        ordem: 3,
        enunciado: 'Por quanto tempo o paciente deve girar e higienizar o brinco após a perfuração para garantir cicatrização adequada?',
        opcoes: [
          { letra: 'a', texto: '2 semanas — tempo de cicatrização superficial.' },
          { letra: 'b', texto: '6 semanas — período de cicatrização completa do lóbulo auricular.' },
          { letra: 'c', texto: '3 meses — para garantir integração total do tecido.' },
          { letra: 'd', texto: 'Apenas nos primeiros 3 dias, quando o risco de infecção é maior.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'O lóbulo auricular necessita de 6 a 8 semanas para cicatrização completa. Neste período, a higienização diária e a rotação do brinco previnem infecção e aderência do fecho à pele.',
      },
    ],
  },

  {
    codigo: 'POP-09',
    titulo: 'Orientação Farmacêutica ao Paciente',
    baseLegal: 'Art. 24, VI, RDC 44/2009',
    objetivo: 'Estabelecer as diretrizes para a realização de orientação farmacêutica individualizada ao paciente, promovendo o uso racional de medicamentos, a adesão ao tratamento e a prevenção de erros de medicação.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Conceito e Importância

A orientação farmacêutica é um serviço de atenção farmacêutica que visa promover o uso seguro e racional de medicamentos, melhorar a adesão ao tratamento e identificar precocemente problemas relacionados a medicamentos (PRMs).

A RDC 44/2009 reconhece a orientação farmacêutica como serviço legítimo da farmácia, devendo ser oferecida a todos os pacientes e registrada no DSF quando realizada de forma estruturada.

### 2. Identificação de Problemas Relacionados a Medicamentos (PRMs)

O farmacêutico deve estar atento a situações de risco durante a dispensação e a orientação:

- **Polimedicação:** pacientes com 5 ou mais medicamentos têm risco elevado de interações
- **Medicamentos de margem terapêutica estreita:** varfarina, digoxina, lítio, fenitoína — pequenas variações de dose têm consequências graves
- **Automedicação:** orientar sobre riscos, especialmente com AINEs e antibióticos
- **Pacientes de grupos de risco:** idosos (risco de quedas com sedativos), gestantes (lista de medicamentos contraindicados na gravidez), crianças (cálculo de dose por peso)

### 3. Estrutura da Orientação (Técnica dos 3 Perguntas)

Técnica padronizada pelo DARE (Drug Action Recognition and Evaluation):

**Pergunta 1 — Para que serve?**
"O que o seu médico lhe disse que este medicamento é para fazer?"
(Confirma se o paciente entende a indicação do seu tratamento)

**Pergunta 2 — Como usar?**
"Como o seu médico lhe disse para tomar este medicamento?"
(Confirma posologia, via de administração, horários)

**Pergunta 3 — O que esperar?**
"O que o seu médico lhe disse para esperar que aconteça?"
(Confirma expectativas, efeitos adversos esperados, sinais de alarme)

Identificadas lacunas, o farmacêutico completa a informação de forma clara, adaptada ao nível de compreensão do paciente.

### 4. Documentação e Seguimento

Toda orientação farmacêutica estruturada deve ser registrada no DSF com:
- Data e identificação do paciente
- Medicamentos abordados
- PRMs identificados e conduta adotada (ajuste posológico sugerido, encaminhamento ao médico, etc.)
- Orientações fornecidas

Para pacientes com múltiplos medicamentos, considerar o **seguimento farmacoterapêutico** com consultas periódicas agendadas.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'O que é a técnica das "3 Perguntas" utilizada na orientação farmacêutica?',
        opcoes: [
          { letra: 'a', texto: 'Uma técnica para verificar se o paciente pagou corretamente pelos medicamentos.' },
          { letra: 'b', texto: 'Uma abordagem estruturada para confirmar se o paciente entende: para que serve, como usar e o que esperar do medicamento.' },
          { letra: 'c', texto: 'Um método de triagem para decidir se o paciente precisa de consulta médica.' },
          { letra: 'd', texto: 'Um formulário que o paciente deve preencher ao receber a medicação.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'As 3 perguntas (para que serve? como usar? o que esperar?) confirmam a compreensão do paciente sobre sua farmacoterapia e permitem identificar lacunas de informação que o farmacêutico deve preencher.',
      },
      {
        ordem: 2,
        enunciado: 'Um paciente idoso chega à farmácia com receita contendo 7 medicamentos diferentes. A primeira preocupação do farmacêutico deve ser:',
        opcoes: [
          { letra: 'a', texto: 'Verificar se todos os medicamentos estão disponíveis em estoque.' },
          { letra: 'b', texto: 'Avaliar o risco de interações medicamentosas e PRMs decorrentes da polimedicação.' },
          { letra: 'c', texto: 'Orientar o paciente a tomar todos os medicamentos de uma vez para facilitar.' },
          { letra: 'd', texto: 'Verificar o plano de saúde para confirmar a cobertura dos medicamentos.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'Polimedicação (5 ou mais medicamentos) é fator de risco para interações e PRMs, especialmente em idosos. A avaliação da farmacoterapia e identificação de PRMs é a primeira responsabilidade do farmacêutico.',
      },
      {
        ordem: 3,
        enunciado: 'Qual documento deve ser emitido quando uma orientação farmacêutica estruturada é realizada na farmácia?',
        opcoes: [
          { letra: 'a', texto: 'Não é necessário documentar, pois a orientação é informal.' },
          { letra: 'b', texto: 'Uma prescrição farmacêutica, equivalente à prescrição médica.' },
          { letra: 'c', texto: 'O DSF (Documento de Serviço Farmacêutico), com todos os dados da orientação e PRMs identificados.' },
          { letra: 'd', texto: 'Um laudo médico, que deve ser assinado pelo farmacêutico e pelo médico.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'A RDC 44/2009 exige o registro da orientação farmacêutica no DSF, incluindo data, paciente, medicamentos abordados, PRMs identificados e orientações fornecidas, com assinatura do farmacêutico RT.',
      },
    ],
  },

  {
    codigo: 'POP-10',
    titulo: 'Higienização das Mãos',
    baseLegal: 'Art. 24, VII, RDC 44/2009 c/c RDC 15/2012',
    objetivo: 'Estabelecer os procedimentos corretos de higienização das mãos para toda a equipe da farmácia, prevenindo a transmissão de microrganismos e garantindo a segurança dos pacientes e profissionais durante a prestação dos serviços farmacêuticos.',
    versao: '1.0',
    minAcertos: 2,
    conteudo: `### 1. Importância e Momentos de Higienização

A higienização das mãos é a medida mais eficaz para prevenção de infecções relacionadas aos serviços de saúde. Na farmácia, a transmissão de microrganismos pode ocorrer durante dispensação, aplicação de injetáveis, aferições e outros serviços.

**Os 5 Momentos da OMS para higienização:**
1. Antes de contato com o paciente
2. Antes de procedimento limpo/asséptico
3. Após risco de exposição a material biológico
4. Após contato com o paciente
5. Após contato com áreas próximas ao paciente

Na farmácia, acrescentar: após manipulação de dinheiro, antes de preparar qualquer solução, após uso do banheiro.

### 2. Técnica com Água e Sabão (40-60 segundos)

Indicada para mãos visivelmente sujas ou contaminadas com material biológico.

1. Umedecer as mãos com água corrente
2. Aplicar a quantidade suficiente de sabonete líquido neutro
3. Esfregar a palma da mão direita sobre o dorso da mão esquerda e vice-versa
4. Entrelaçar os dedos e esfregar entre eles
5. Esfregar o dorso dos dedos na palma oposta (mãos entrelaçadas)
6. Esfregar ao redor do polegar direito e esquerdo
7. Esfregar as pontas dos dedos na palma oposta com movimentos circulares
8. Enxaguar as mãos com água corrente
9. Secar com papel toalha descartável
10. Fechar a torneira usando o papel toalha

### 3. Técnica com Álcool Gel 70% (20-30 segundos)

Indicada para mãos visivelmente limpas. NÃO substitui a lavagem quando há sujidade visível.

1. Aplicar quantidade suficiente (3-5 mL) de álcool gel 70% na palma
2. Seguir as mesmas etapas de esfregação (passos 3 a 7 acima)
3. Esfregar até as mãos secarem completamente (não enxaguar)

**Luvas NÃO substituem a higienização das mãos:** higienizar ANTES de calçar e APÓS retirar as luvas.

### 4. Cuidados com a Pele e Monitoramento

O uso frequente de sabão e álcool pode ressecar a pele. Orientar:
- Uso de hidratante após o expediente
- Reporte de dermatites ao farmacêutico RT

O farmacêutico RT deve monitorar a adesão à higienização por meio de observação direta e registrar ocorrências de não conformidade. A dispensa de hidratante e o reabastecimento de dispensadores é responsabilidade da gestão da farmácia.`,
    questoes: [
      {
        ordem: 1,
        enunciado: 'Em qual situação a higienização das mãos com ÁLCOOL GEL não é adequada e deve-se usar água e sabão?',
        opcoes: [
          { letra: 'a', texto: 'Após contato com paciente — o álcool gel não é eficaz nesta situação.' },
          { letra: 'b', texto: 'Antes de procedimento asséptico — requer maior eficácia germicida.' },
          { letra: 'c', texto: 'Quando as mãos estão visivelmente sujas ou contaminadas com material biológico.' },
          { letra: 'd', texto: 'O álcool gel nunca é adequado — água e sabão devem ser sempre utilizados.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'O álcool gel age por volatilização e não remove fisicamente sujidade, sangue ou fezes. Quando há contaminação visível, a lavagem com água e sabão é obrigatória para remoção mecânica dos microrganismos.',
      },
      {
        ordem: 2,
        enunciado: 'Qual é o tempo mínimo recomendado para a higienização das mãos com água e sabão?',
        opcoes: [
          { letra: 'a', texto: '10 segundos — tempo suficiente para remover bactérias superficiais.' },
          { letra: 'b', texto: '40 a 60 segundos — tempo necessário para a ação mecânica e química do sabonete.' },
          { letra: 'c', texto: '2 minutos — equivalente à lavagem cirúrgica das mãos.' },
          { letra: 'd', texto: '5 segundos com esfregação vigorosa substituem o tempo prolongado.' },
        ],
        respostaCorreta: 'b',
        justificativa: 'A OMS recomenda 40 a 60 segundos para higienização com água e sabão, tempo necessário para que o sabonete atue e os movimentos mecânicos removam os microrganismos de todas as superfícies das mãos.',
      },
      {
        ordem: 3,
        enunciado: 'Sobre o uso de luvas durante os serviços farmacêuticos, qual afirmativa está CORRETA?',
        opcoes: [
          { letra: 'a', texto: 'Luvas substituem a higienização das mãos — basta trocá-las entre pacientes.' },
          { letra: 'b', texto: 'Com luvas, não é necessário higienizar as mãos antes de procedimentos.' },
          { letra: 'c', texto: 'As mãos devem ser higienizadas ANTES de calçar as luvas E APÓS retirá-las.' },
          { letra: 'd', texto: 'Luvas de borracha de uso doméstico são equivalentes às luvas de procedimento.' },
        ],
        respostaCorreta: 'c',
        justificativa: 'Luvas não são impermeáveis a microrganismos e podem ter microfuros. A higienização antes de calçar previne contaminação do interior da luva; após retirar, remove contaminação que pode ter atravessado o material.',
      },
    ],
  },
]

async function main() {
  console.log('Iniciando seed dos POPs padrão FarmaSign...')

  let criados = 0
  let ignorados = 0

  for (const pop of POPS) {
    const existente = await prisma.documentoPOP.findFirst({
      where: { codigo: pop.codigo, tenantId: null },
    })

    if (existente) {
      console.log(`  IGNORADO (já existe): ${pop.codigo} — ${pop.titulo}`)
      ignorados++
      continue
    }

    const doc = await prisma.documentoPOP.create({
      data: {
        tenantId: null,
        codigo: pop.codigo,
        titulo: pop.titulo,
        baseLegal: pop.baseLegal,
        objetivo: pop.objetivo,
        conteudo: pop.conteudo,
        versao: pop.versao,
        minAcertos: pop.minAcertos,
        vigente: true,
      },
    })

    await Promise.all(
      pop.questoes.map(q =>
        prisma.questaoQuiz.create({
          data: {
            documentoId: doc.id,
            ordem: q.ordem,
            enunciado: q.enunciado,
            opcoes: q.opcoes as any,
            respostaCorreta: q.respostaCorreta,
            justificativa: q.justificativa,
          },
        })
      )
    )

    console.log(`  CRIADO: ${pop.codigo} — ${pop.titulo} (${pop.questoes.length} questões)`)
    criados++
  }

  console.log(`\nConcluído: ${criados} POPs criados, ${ignorados} ignorados.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
