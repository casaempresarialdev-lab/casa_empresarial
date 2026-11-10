// Holerites em PDF enviados pela contabilidade (payroll_documents)

export const TIPOS_DOCUMENTO = ['mensal', 'ferias', 'decimo_1', 'decimo_2', 'outro'] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const ROTULO_DOCUMENTO: Record<TipoDocumento, string> = {
  mensal: 'Holerite mensal',
  ferias: 'Recibo de férias',
  decimo_1: '13º salário · 1ª parcela',
  decimo_2: '13º salário · 2ª parcela',
  outro: 'Outro recibo',
}

export type HoleriteEnviado = {
  id: string
  employee_id: string
  competencia: string
  tipo: TipoDocumento
  arquivo_nome: string
  enviado_por_nome: string | null
  created_at: string
}
