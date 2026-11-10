// Regras da folha configuráveis por empresa e as datas que saem delas. Puro: usado no servidor e na tela.

import { feriadoDoDia, type FeriadoEmpresa } from '@/lib/escala/feriados'
import { periodoDoMes, somarDias } from '@/lib/escala/periodo'
import type { ConfigFerias } from '@/lib/ferias/regras'

export type ConfigFolha = ConfigFerias & {
  /** Sem dia de corte, a apuração é o mês cheio */
  dia_corte: number | null
  pagamento_tipo: 'dia_util' | 'dia_fixo'
  pagamento_dia: number
  adiantamento_ativo: boolean
  adiantamento_dia: number
  adiantamento_percentual: number
  guias_dia: number
  /** Sem dia próprio, vence junto com o salário */
  beneficios_dia: number | null
  he_percentual: number
  he_feriado_percentual: number
  he_domingo_percentual: number
  tolerancia_minutos: number
  responsavel_calculo: 'sistema' | 'contabilidade'
  holerite_ativo: boolean
  /** Holerite do colaborador: o gerado pelo sistema ou o PDF enviado pela contabilidade */
  holerite_fonte: 'sistema' | 'arquivo'
  dsr_reflexo_ativo: boolean
  dsr_desconta_falta: boolean
  noturno_ativo: boolean
  noturno_inicio: string
  noturno_fim: string
  noturno_percentual: number
  noturno_hora_reduzida: boolean
  insalubridade_base: 'salario_minimo' | 'salario_base'
  salario_minimo: number
}

/** Adicional de risco do cargo (Minha Empresa → Estrutura) */
export type AdicionalCargo = 'nenhum' | 'insalubridade_10' | 'insalubridade_20' | 'insalubridade_40' | 'periculosidade'

export const ROTULO_ADICIONAL: Record<AdicionalCargo, string> = {
  nenhum: 'Nenhum',
  insalubridade_10: 'Insalubridade mínima (10%)',
  insalubridade_20: 'Insalubridade média (20%)',
  insalubridade_40: 'Insalubridade máxima (40%)',
  periculosidade: 'Periculosidade (30%)',
}

/**
 * Adicional que vale para a pessoa: a exceção da ficha ou, sem ela, o do cargo.
 * Sem a coluna adicional_risco (migration 20261110000103), o antigo tem_periculosidade ainda vale.
 */
export function adicionalDaPessoa(f: { adicional_risco?: string | null; tem_periculosidade?: boolean | null }, doCargo: string | null | undefined): AdicionalCargo {
  if (f.adicional_risco) return f.adicional_risco as AdicionalCargo
  if (f.adicional_risco === undefined && f.tem_periculosidade) return 'periculosidade'
  return (doCargo as AdicionalCargo | null | undefined) || 'nenhum'
}

/**
 * Insalubridade do cargo no valor do mês. "fator" é a parte do mês paga (admissão no meio do mês).
 * Periculosidade é calculada sobre o salário em calcularFolha.
 */
export function insalubridadeDoCargo(adicional: string | null | undefined, cfg: Pick<ConfigFolha, 'insalubridade_base' | 'salario_minimo'>, salarioCheio: number, fator = 1) {
  const pct = adicional === 'insalubridade_10' ? 10 : adicional === 'insalubridade_20' ? 20 : adicional === 'insalubridade_40' ? 40 : 0
  if (!pct) return undefined
  const base = cfg.insalubridade_base === 'salario_base' ? salarioCheio : Number(cfg.salario_minimo)
  return { pct, valor: Math.round(base * (pct / 100) * fator * 100) / 100 }
}

export const CONFIG_FOLHA_PADRAO: ConfigFolha = {
  dia_corte: null,
  pagamento_tipo: 'dia_util',
  pagamento_dia: 5,
  adiantamento_ativo: false,
  adiantamento_dia: 20,
  adiantamento_percentual: 40,
  guias_dia: 20,
  beneficios_dia: null,
  he_percentual: 50,
  he_feriado_percentual: 100,
  he_domingo_percentual: 100,
  tolerancia_minutos: 10,
  responsavel_calculo: 'contabilidade',
  holerite_ativo: false,
  holerite_fonte: 'sistema',
  dsr_reflexo_ativo: true,
  dsr_desconta_falta: true,
  noturno_ativo: true,
  noturno_inicio: '22:00',
  noturno_fim: '05:00',
  noturno_percentual: 20,
  noturno_hora_reduzida: true,
  insalubridade_base: 'salario_minimo',
  salario_minimo: 1621,
  ferias_solicitacao_ativa: true,
  ferias_antecedencia_dias: 30,
  ferias_permite_fracionar: true,
  ferias_permite_abono: true,
}

const pad = (n: number) => String(n).padStart(2, '0')
const semana = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

/** Dias que o ponto apura para a competência */
export function periodoApuracao(mesAno: string, cfg: Pick<ConfigFolha, 'dia_corte'>) {
  const mes = periodoDoMes(`${mesAno}-01`)
  if (!cfg.dia_corte) return { inicio: mes.inicio, fim: mes.fim }
  const dia = pad(cfg.dia_corte)
  return { inicio: somarDias(`${mes.anterior.slice(0, 8)}${dia}`, 1), fim: `${mesAno}-${dia}` }
}

/** Salário: sábado conta como dia útil; domingo e feriado, não */
const ehDiaUtilPagamento = (iso: string, feriados: FeriadoEmpresa[]) => semana(iso) !== 0 && !feriadoDoDia(iso, feriados)

/** Guias: só em dia de expediente bancário */
const ehDiaBancario = (iso: string, feriados: FeriadoEmpresa[]) => ![0, 6].includes(semana(iso)) && !feriadoDoDia(iso, feriados)

function enesimoDiaUtil(prefixoMes: string, n: number, feriados: FeriadoEmpresa[]) {
  let data = `${prefixoMes}-01`
  let contados = ehDiaUtilPagamento(data, feriados) ? 1 : 0
  while (contados < n) {
    data = somarDias(data, 1)
    if (ehDiaUtilPagamento(data, feriados)) contados++
  }
  return data
}

/** Quando cada pagamento da competência vence */
export function vencimentosFolha(mesAno: string, cfg: ConfigFolha, feriados: FeriadoEmpresa[]) {
  const seguinte = periodoDoMes(`${mesAno}-01`).proximo.slice(0, 7)
  const salario = cfg.pagamento_tipo === 'dia_util'
    ? enesimoDiaUtil(seguinte, cfg.pagamento_dia, feriados)
    : `${seguinte}-${pad(cfg.pagamento_dia)}`

  let guias = `${seguinte}-${pad(cfg.guias_dia)}`
  while (!ehDiaBancario(guias, feriados)) guias = somarDias(guias, -1)

  return {
    salario,
    adiantamento: `${mesAno}-${pad(cfg.adiantamento_dia)}`,
    beneficios: cfg.beneficios_dia ? `${seguinte}-${pad(cfg.beneficios_dia)}` : salario,
    guias,
  }
}

/** O próprio dia, se for dia de expediente bancário, ou o último antes dele (pagamentos com prazo "até") */
export function diaBancarioAte(iso: string, feriados: FeriadoEmpresa[]) {
  let d = iso
  while (!ehDiaBancario(d, feriados)) d = somarDias(d, -1)
  return d
}

/** DSR: dias úteis e dias de descanso (domingos e feriados) do período */
export function diasDsr(inicio: string, fim: string, feriados: FeriadoEmpresa[]) {
  let diasUteis = 0
  let descansos = 0
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    if (semana(d) === 0 || feriadoDoDia(d, feriados)) descansos++
    else diasUteis++
  }
  return { diasUteis, descansos }
}

export const fmtDataBr = (iso: string) => iso.split('-').reverse().join('/')
