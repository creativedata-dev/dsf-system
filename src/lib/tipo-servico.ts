// Sem import do Prisma — seguro para Client Components
export const TIPO_SERVICO_LABELS: Record<string, string> = {
  AFERICAO_PRESSAO_ARTERIAL:   'Aferição de Pressão Arterial',
  AFERICAO_TEMPERATURA:        'Aferição de Temperatura',
  GLICEMIA_CAPILAR:            'Glicemia Capilar',
  TESTE_RAPIDO_COVID19:        'Teste Rápido — COVID-19',
  TESTE_RAPIDO_DENGUE:         'Teste Rápido — Dengue',
  TESTE_RAPIDO_INFLUENZA:      'Teste Rápido — Influenza',
  TESTE_RAPIDO_BETA_HCG:       'Teste Rápido — Beta-HCG (Gravidez)',
  TESTE_RAPIDO_PERFIL_LIPIDICO:'Teste Rápido — Perfil Lipídico',
  ADMINISTRACAO_INJETAVEIS:    'Administração de Injetáveis',
  INALACAO_NEBULIZACAO:        'Inalação / Nebulização',
  PERFURACAO_LOBULO:           'Perfuração de Lóbulo',
}

export const TIPO_SERVICO_OPTIONS = Object.entries(TIPO_SERVICO_LABELS).map(
  ([value, label]) => ({ value, label }),
)
