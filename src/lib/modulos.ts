export interface ModuloDefinition {
  slug: string
  label: string
  descricao: string
  icone: string
}

export const MODULOS_DISPONIVEIS: ModuloDefinition[] = [
  {
    slug: 'DSF',
    label: 'Emissão DSF',
    descricao: 'Emissão de Documentos de Serviço Farmacêutico (11 tipos RDC 44/2009)',
    icone: '📄',
  },
  {
    slug: 'TEMPERATURA',
    label: 'Temperatura e Umidade',
    descricao: 'Registro de termo-higrometria 2x/dia, alertas e exportação PDF para vistoria',
    icone: '🌡️',
  },
  {
    slug: 'EQUIPAMENTOS',
    label: 'Equipamentos e Calibração',
    descricao: 'Gestão de laudos de calibração com alertas de vencimento (esfigmo, glicosímetro, etc.)',
    icone: '🔧',
  },
  {
    slug: 'POPS',
    label: 'POPs e Treinamentos',
    descricao: 'Upload de POPs e assinatura digital de ciência por funcionários',
    icone: '📋',
  },
  {
    slug: 'VALIDADE',
    label: 'Controle de Validade',
    descricao: 'Gestão de lotes por validade, quarentena e descarte com auto de inutilização',
    icone: '📅',
  },
  {
    slug: 'PAINEL_FISCAL',
    label: 'Painel do Fiscal',
    descricao: 'Exportação de pacote de conformidade em PDF único para vistorias da Vigilância Sanitária',
    icone: '🗂️',
  },
  {
    slug: 'FRACIONAMENTO',
    label: 'Fracionamento',
    descricao: 'Rastreabilidade de fracionamento de medicamentos com etiquetas QR Code vinculadas ao lote original',
    icone: '✂️',
  },
]

export const MODULOS_SLUGS = MODULOS_DISPONIVEIS.map(m => m.slug)

/**
 * Verifica se um tenant tem acesso a um módulo.
 * Array vazio = tenant legado = todos os módulos liberados (retrocompatibilidade).
 */
export function hasModulo(modulosHabilitados: string[], slug: string): boolean {
  if (modulosHabilitados.length === 0) return true
  return modulosHabilitados.includes(slug)
}
