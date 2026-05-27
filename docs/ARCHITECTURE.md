Memorial Descritivo de Arquitetura e Plano Estratégico
Projeto: Sistema SaaS de Gestão de DSF para Drogarias
1. Visão Geral do Produto
O sistema é uma plataforma SaaS (Software as a Service) Multi-tenant projetada especificamente para drogarias (iniciando a operação com a Drogaria Rio). O objetivo principal é a emissão, impressão e armazenamento de Declarações de Serviços Farmacêuticos (DSF), garantindo total conformidade com as normas regulatórias da ANVISA (RDC 44/2009) e segurança jurídica através da LGPD (Dados Sensíveis de Saúde).

2. Stack Tecnológica e Infraestrutura
A escolha da stack visa custo operacional inicial próximo de zero (infraestrutura serverless), alta escalabilidade e isolamento de dados.

Framework Principal: Next.js (App Router) — Unificando Frontend e Backend (API Routes) em TypeScript.

Hospedagem & Compute: Vercel (Edge/Serverless Platform).

Banco de Dados: Neon (PostgreSQL Serverless) com gerenciamento de conexões otimizado para Serverless.

ORM: Prisma ORM.

Armazenamento de Arquivos: Google Drive de cada Tenant via Integração OAuth 2.0 (Google Workspace / Gmail do Cliente).

Autenticação & RBAC: NextAuth.js ou JWT nativo com controle de acesso baseado em papéis.

3. Modelo de Dados e Multi-Tenancy
O sistema adota a estratégia de Banco de Dados Único com Esquema Compartilhado, onde o isolamento lógico é feito estritamente através da coluna tenant_id em todas as tabelas operacionais.

Níveis de Acesso (RBAC)
SUPER_ADMIN: Gestão global de tenants, faturamento e auditoria centralizada.

ADMIN: Gestão administrativa da drogaria contratante (usuários, configurações locais).

SUPERVISOR: Liberação de permissões especiais, estornos e edições cadastrais.

ATENDENTE: Operação de balcão (cadastro de clientes e emissão de DSF).

RESPONSAVEL_TECNICO: Farmacêutico responsável (obrigatório CRF para assinatura sanitária).

4. Engenharia de Armazenamento Dedicado (Google Drive por Tenant)
Para descentralização de custos e conformidade jurídica, cada farmácia armazena seus próprios documentos.

Fluxo: O sistema utiliza o fluxo OAuth 2.0 do Google. O Admin do estabelecimento autoriza o app (escopo drive.file).

Segurança: O refresh_token de cada tenant retornado pelo Google é obrigatoriamente criptografado em repouso (utilizando aes-256-gcm no Node.js) antes de ser persistido no Neon.

Estrutura: O sistema cria programaticamente uma pasta raiz no Drive do cliente e organiza os arquivos por lá. Os arquivos não possuem acesso público direto.

5. Governança, Auditoria e Compliance (ANVISA & LGPD)
Como o sistema manipula dados clínicos e de anamnese, a rastreabilidade é nativa.

Trilha de Auditoria (Audit Trail): Todas as ações críticas (Login, cadastro de clientes, emissão de DSF, visualização de documentos, alteração de credenciais do Drive) disparam um registro na tabela AuditLog.

Dados Coletados por Log: Tenant, Usuário, Ação (Enum), ID do Recurso afetado, Timestamp, IP e User-Agent.

Disponibilização Fase 1: Os logs serão consolidados em um painel exclusivo do Super Admin, contando com paginação obrigatória baseada em cursor/limite estrito (50 registros por página) e ordenação decrescente para mitigar gargalos de performance na Vercel.

Requisitos RDC 44/2009: Todo registro de DSF obriga o vínculo do Responsável Técnico (CRF), número de lote e fabricante dos insumos utilizados (ex: testes rápidos, seringas).

6. Diretrizes para a Impressão Térmica (Desafio Serverless)
Devido ao ciclo de vida efêmero das Serverless Functions na Vercel (Timeouts de 10-15s), o backend não faz conexão direta via rede com as impressoras de cupom das farmácias.

Estratégia: O backend processa as informações e entrega os dados estruturados em JSON, comandos ESC/POS puros ou HTML/CSS para o Frontend.

Execução: O Frontend Next.js do operador executa a rotina de impressão localmente utilizando as APIs do navegador (ex: window.print() estilizado ou integrações de hardware via WebUSB/WebSerial para comandos ESC/POS puros na impressora térmica).

Próximo Passo Operacional (Para o Chat do VS Code com o Claude)
Para iniciar o desenvolvimento do código seguindo este plano, inicialize o projeto Next.js e passe o seguinte prompt inicial para o Claude:

