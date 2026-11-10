// Regras de férias da CLT, puras: usadas no servidor para validar e na tela para orientar.
// Período aquisitivo: 12 meses a partir da admissão. Concessivo: os 12 meses seguintes, prazo para as férias começarem.

import { somarDias } from '@/lib/escala/periodo'

export const DIREITO_DIAS = 30
export const ABONO_MAX = 10
export const FRACOES_MAX = 3
export const FRACAO_MIN = 5
export const FRACAO_LONGA = 14
/** A partir de quantos dias para o fim do concessivo o período aparece como vencendo */
export const AVISO_VENCIMENTO_DIAS = 60

export type ConfigFerias = {
  ferias_solicitacao_ativa: boolean
  ferias_antecedencia_dias: number
  ferias_permite_fracionar: boolean
  ferias_permite_abono: boolean
}

export type StatusFerias = 'solicitada' | 'aprovada' | 'recusada' | 'cancelada'

export type FeriasRegistro = {
  id: string
  data_inicio: string
  dias: number
  dias_abono: number
  status: StatusFerias
  periodo_inicio: string | null
}

export type SituacaoPeriodo = 'em_aquisicao' | 'disponivel' | 'vencendo' | 'concluido'

export type PeriodoAquisitivo = {
  inicio: string
  fim: string
  /** Último dia para as férias começarem sem pagamento em dobro */
  concessivoFim: string
  situacao: SituacaoPeriodo
  /** Dias já aprovados (férias e abono) */
  usados: number
  /** Dias em pedidos aguardando aprovação */
  reservados: number
  saldo: number
  fracoes: number
  temFracaoLonga: boolean
  abonoUsado: boolean
  /** Meses completos, para o período em aquisição */
  mesesAdquiridos: number
}

const addAnos = (iso: string, anos: number) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a + anos, m - 1, d)).toISOString().slice(0, 10)
}

export const fimDasFerias = (inicio: string, dias: number) => somarDias(inicio, dias - 1)

const ativas = (f: FeriasRegistro) => f.status === 'aprovada' || f.status === 'solicitada'

function mesesEntre(inicio: string, hoje: string) {
  const [a1, m1, d1] = inicio.split('-').map(Number)
  const [a2, m2, d2] = hoje.split('-').map(Number)
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0))
}

/** Período a que as férias pertencem: o informado ou, nas antigas, o primeiro cujo concessivo contém o início */
export function periodoDasFerias(f: FeriasRegistro, periodos: Pick<PeriodoAquisitivo, 'inicio' | 'fim' | 'concessivoFim'>[]) {
  if (f.periodo_inicio) return periodos.find((p) => p.inicio === f.periodo_inicio) ?? null
  return periodos.find((p) => f.data_inicio > p.fim && f.data_inicio <= p.concessivoFim) ?? null
}

/**
 * Períodos que ainda importam: o que está em aquisição e os já completos cujo prazo de concessão não acabou.
 * Os anteriores ficam de fora: as férias deles costumam ter sido tiradas antes do sistema.
 */
export function calcularPeriodos(admissao: string | null, hoje: string, ferias: FeriasRegistro[]): PeriodoAquisitivo[] {
  if (!admissao) return []
  const base: Pick<PeriodoAquisitivo, 'inicio' | 'fim' | 'concessivoFim'>[] = []
  for (let k = 0; k < 80; k++) {
    const inicio = addAnos(admissao, k)
    if (inicio > hoje) break
    const fim = somarDias(addAnos(admissao, k + 1), -1)
    const concessivoFim = somarDias(addAnos(admissao, k + 2), -1)
    if (concessivoFim >= hoje) base.push({ inicio, fim, concessivoFim })
  }

  return base.map((p) => {
    const dele = ferias.filter((f) => ativas(f) && periodoDasFerias(f, base)?.inicio === p.inicio)
    const soma = (lista: FeriasRegistro[]) => lista.reduce((t, f) => t + f.dias + f.dias_abono, 0)
    const usados = soma(dele.filter((f) => f.status === 'aprovada'))
    const reservados = soma(dele.filter((f) => f.status === 'solicitada'))
    const saldo = Math.max(0, DIREITO_DIAS - usados - reservados)
    const situacao: SituacaoPeriodo = hoje <= p.fim ? 'em_aquisicao'
      : saldo === 0 ? 'concluido'
      : somarDias(hoje, AVISO_VENCIMENTO_DIAS) >= p.concessivoFim ? 'vencendo' : 'disponivel'
    return {
      ...p,
      situacao,
      usados,
      reservados,
      saldo,
      fracoes: dele.length,
      temFracaoLonga: dele.some((f) => f.dias >= FRACAO_LONGA),
      abonoUsado: dele.some((f) => f.dias_abono > 0),
      mesesAdquiridos: Math.min(12, mesesEntre(p.inicio, hoje)),
    }
  })
}

export type PedidoFerias = { inicio: string; dias: number; abono: number }

/**
 * O que impede estas férias, ou null. O colaborador segue todas as regras; a área de Pessoas pode programar
 * fora do prazo (com pagamento em dobro) ou antes de completar o período (férias antecipadas por acordo).
 * `diasSeguintes`: os 2 dias depois do início, para a regra do feriado e do repouso (art. 134 §3º).
 */
export function validarFerias(opcoes: {
  periodo: PeriodoAquisitivo
  pedido: PedidoFerias
  config: ConfigFerias
  hoje: string
  origem: 'colaborador' | 'gestor'
  diasSeguintes?: { feriado: boolean; folga: boolean }[]
}): string | null {
  const { periodo: p, pedido, config, hoje, origem, diasSeguintes = [] } = opcoes
  const { inicio, dias, abono } = pedido
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return 'Informe o início das férias.'
  if (!Number.isInteger(dias) || dias < 1) return 'Informe os dias de férias.'

  if (origem === 'colaborador') {
    if (inicio <= p.fim) return `Este período aquisitivo termina em ${fmt(p.fim)}: as férias só podem começar depois disso.`
    if (inicio > p.concessivoFim) return `As férias deste período precisam começar até ${fmt(p.concessivoFim)}.`
    const minimo = somarDias(hoje, config.ferias_antecedencia_dias)
    if (inicio < minimo) return `Peça com pelo menos ${config.ferias_antecedencia_dias} dias de antecedência: o início mais cedo é ${fmt(minimo)}.`
  }

  if (abono > 0) {
    if (!config.ferias_permite_abono) return 'A empresa não permite vender dias de férias.'
    if (abono > ABONO_MAX) return `O abono vai até ${ABONO_MAX} dias.`
    if (p.abonoUsado) return 'O abono deste período já foi usado.'
  }

  const total = dias + abono
  if (total > p.saldo) return `O saldo deste período é de ${p.saldo} ${p.saldo === 1 ? 'dia' : 'dias'}.`
  const restante = p.saldo - total

  if (!config.ferias_permite_fracionar) {
    if (p.fracoes > 0) return 'A empresa não permite dividir as férias, e este período já tem férias marcadas.'
    if (restante > 0) return `A empresa não permite dividir as férias: tire os ${p.saldo - abono} dias de uma vez.`
  } else {
    if (p.fracoes >= FRACOES_MAX) return `As férias deste período já estão divididas em ${FRACOES_MAX} partes, o máximo da CLT.`
    if (dias < FRACAO_MIN) return `Cada parte das férias precisa ter ao menos ${FRACAO_MIN} dias.`
    if (!p.temFracaoLonga && dias < FRACAO_LONGA && restante < FRACAO_LONGA) return `Uma das partes precisa ter ao menos ${FRACAO_LONGA} dias. Aumente esta ou deixe saldo para uma parte de ${FRACAO_LONGA}.`
    if (p.fracoes === FRACOES_MAX - 1 && restante > 0) return `Esta é a última parte permitida: use os ${p.saldo - abono} dias restantes.`
    if (restante > 0 && restante < FRACAO_MIN) return `Sobrariam ${restante} dias, menos que o mínimo de ${FRACAO_MIN} para outra parte.`
  }

  if (diasSeguintes.some((d) => d.feriado || d.folga)) return 'Pela CLT, as férias não podem começar nos 2 dias antes de um feriado ou de uma folga.'
  return null
}

export const fmt = (iso: string) => iso.split('-').reverse().join('/')

export const ROTULO_SITUACAO: Record<SituacaoPeriodo, { texto: string; fundo: string; cor: string }> = {
  em_aquisicao: { texto: 'Em aquisição', fundo: '#F3F4F6', cor: '#6B7280' },
  disponivel: { texto: 'Disponível', fundo: '#DCFCE7', cor: '#15803D' },
  vencendo: { texto: 'Vencendo', fundo: '#FEF3C7', cor: '#B45309' },
  concluido: { texto: 'Concluído', fundo: '#DBEAFE', cor: '#1D4ED8' },
}

export const ROTULO_STATUS: Record<StatusFerias, { texto: string; fundo: string; cor: string }> = {
  solicitada: { texto: 'Aguardando aprovação', fundo: '#FEF3C7', cor: '#B45309' },
  aprovada: { texto: 'Aprovada', fundo: '#DCFCE7', cor: '#15803D' },
  recusada: { texto: 'Recusada', fundo: '#FEE2E2', cor: '#B91C1C' },
  cancelada: { texto: 'Cancelada', fundo: '#F3F4F6', cor: '#6B7280' },
}
