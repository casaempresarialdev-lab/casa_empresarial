// Segurança e saúde do trabalho: tipos de registro e situação da validade. Puro: servidor e tela.

import type { IconName } from '@/components/ui/icon'

export const TIPOS_SS = ['aso', 'treinamento', 'epi', 'incidente', 'vacina'] as const
export type TipoSS = (typeof TIPOS_SS)[number]

export const ROTULO_TIPO_SS: Record<TipoSS, string> = {
  aso: 'ASO',
  treinamento: 'Treinamento',
  epi: 'EPI',
  incidente: 'Incidente',
  vacina: 'Vacinação',
}

/** Nome completo, para o formulário */
export const ROTULO_TIPO_SS_LONGO: Record<TipoSS, string> = {
  aso: 'ASO (Atestado de Saúde Ocupacional)',
  treinamento: 'Treinamento',
  epi: 'EPI (Equipamento de Proteção)',
  incidente: 'Incidente / Acidente',
  vacina: 'Vacinação',
}

export const ICONE_TIPO_SS: Record<TipoSS, IconName> = {
  aso: 'stethoscope',
  treinamento: 'star',
  epi: 'shield',
  incidente: 'info',
  vacina: 'check',
}

export const RESULTADO_ASO: Record<string, string> = { apto: 'Apto', apto_com_restricoes: 'Apto com restrições', inapto: 'Inapto' }

export const VENCENDO_DIAS = 30

export type SituacaoValidade = 'vencido' | 'vencendo' | 'em_dia' | 'sem_validade'

const diasAte = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000)
const fmt = (d: string) => d.split('-').reverse().join('/')
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function situacaoValidade(vencimento: string | null, hoje: string): SituacaoValidade {
  if (!vencimento) return 'sem_validade'
  const dias = diasAte(hoje, vencimento)
  return dias < 0 ? 'vencido' : dias <= VENCENDO_DIAS ? 'vencendo' : 'em_dia'
}

/** Texto e cores do selo de validade; sem vencimento, nada */
export function seloValidade(vencimento: string | null, hoje: string): { texto: string; fundo: string; cor: string } | null {
  const s = situacaoValidade(vencimento, hoje)
  if (s === 'sem_validade') return null
  const dias = diasAte(hoje, vencimento!)
  if (s === 'vencido') return { texto: 'Vencido', fundo: '#FEE2E2', cor: '#B91C1C' }
  if (s === 'vencendo') return { texto: dias === 0 ? 'Vence hoje' : `Vence em ${plural(dias, 'dia', 'dias')}`, fundo: '#FEF3C7', cor: '#B45309' }
  return { texto: `Válido até ${fmt(vencimento!)}`, fundo: '#DCFCE7', cor: '#15803D' }
}
