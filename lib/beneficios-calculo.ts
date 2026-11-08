// Cálculo dos benefícios: o que a empresa oferece, o que é descontado do colaborador e o custo que sobra para a empresa.
// Puro: usado no cadastro, na folha e nos encargos, para os três darem sempre o mesmo número.

export const REGRAS_DESCONTO = [
  { value: 'nenhum', label: 'Sem desconto' },
  { value: 'percentual_salario', label: 'Percentual do salário' },
  { value: 'percentual_beneficio', label: 'Percentual do benefício' },
  { value: 'valor_fixo', label: 'Valor fixo por mês' },
] as const

export type RegraDesconto = (typeof REGRAS_DESCONTO)[number]['value']

export const isRegraDesconto = (v: unknown): v is RegraDesconto => REGRAS_DESCONTO.some((r) => r.value === v)

export const DIAS_UTEIS_MES = 22

export type BeneficioCalculo = {
  valor: number
  por_dia_trabalhado: boolean
  desconto_tipo?: string | null
  desconto_valor?: number | null
  /** Campo antigo: só é lido enquanto a migration 20261108000089 não foi aplicada */
  desconta_salario?: boolean
}

const centavos = (v: number) => Math.round(v * 100) / 100
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function regra(b: BeneficioCalculo): { tipo: RegraDesconto; valor: number } {
  if (isRegraDesconto(b.desconto_tipo)) return { tipo: b.desconto_tipo, valor: Number(b.desconto_valor ?? 0) }
  return b.desconta_salario ? { tipo: 'percentual_beneficio', valor: 100 } : { tipo: 'nenhum', valor: 0 }
}

/** O que a empresa oferece por mês; o valor ajustado para a pessoa substitui o do cadastro */
export function valorMensal(b: BeneficioCalculo, valorPessoa?: number | null) {
  const v = valorPessoa ?? b.valor
  return centavos(b.por_dia_trabalhado ? v * DIAS_UTEIS_MES : v)
}

/** O que sai do salário por mês. Nunca passa do valor do benefício. */
export function descontoMensal(b: BeneficioCalculo, valorPessoa: number | null | undefined, salario: number | null | undefined) {
  const oferecido = valorMensal(b, valorPessoa)
  const { tipo, valor } = regra(b)
  const desconto =
    tipo === 'percentual_salario' ? (salario ?? 0) * (valor / 100)
      : tipo === 'percentual_beneficio' ? oferecido * (valor / 100)
      : tipo === 'valor_fixo' ? valor
      : 0
  return centavos(Math.min(desconto, oferecido))
}

/** O que sobra para a empresa pagar */
export function custoEmpresaMensal(b: BeneficioCalculo, valorPessoa: number | null | undefined, salario: number | null | undefined) {
  return centavos(valorMensal(b, valorPessoa) - descontoMensal(b, valorPessoa, salario))
}

/** "6% do salário", "R$ 80,00 de desconto"... */
export function descricaoDesconto(b: BeneficioCalculo) {
  const { tipo, valor } = regra(b)
  const pct = `${String(valor).replace('.', ',')}%`
  if (tipo === 'percentual_salario') return `Desconta ${pct} do salário`
  if (tipo === 'percentual_beneficio') return `Desconta ${pct} do benefício`
  if (tipo === 'valor_fixo') return `Desconta ${moeda(valor)} por mês`
  return 'Sem desconto'
}
