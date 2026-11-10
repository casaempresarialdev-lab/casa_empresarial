// Recibos fora da folha mensal: férias e 13º salário. Puro: o servidor congela o resultado e a tela só exibe.

import { calcInss, calcIrrf, calcularFolha, type AjustesFolha, type ApuracaoPonto, type InsumosFolha } from '@/lib/folha/calculo'
import { fmtDataBr } from '@/lib/folha/config'
import { documento, type DocumentoHolerite } from '@/lib/folha/holerite'

const c = (v: number) => Math.round(v * 100) / 100
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export type MesFechado = { insumos: InsumosFolha; ponto: ApuracaoPonto; ajustes: AjustesFolha }

/** Média mensal do que varia (horas extras, adicional noturno, DSR e comissões) nas folhas fechadas informadas */
export function mediaVariaveis(meses: MesFechado[]) {
  if (!meses.length) return { media: 0, meses: 0 }
  const total = meses.reduce((t, m) => {
    const r = calcularFolha(m.insumos, m.ponto, m.ajustes)
    const v = r.valores
    return t + v.horas_extras + v.horas_extras_feriado + v.horas_extras_domingo + v.adicional_noturno + r.dsr + v.bonus
  }, 0)
  return { media: c(total / meses.length), meses: meses.length }
}

// ── Férias ────────────────────────────────────────────────────────────────────

export type ReciboFerias = DocumentoHolerite & {
  resumo: {
    dias: number
    abono: number
    inicio: string
    fim: string
    pagamentoEm: string
    /** Férias com a média, sem o 1/3: é o que entra na base do INSS e do FGTS do mês, junto com o 1/3 */
    ferias: number
    terco: number
    abonoValor: number
    inss: number
    irrf: number
  }
}

/**
 * Férias (art. 142 e 145 da CLT): remuneração do mês mais a média das variáveis, por 30 dias, com 1/3.
 * O abono pecuniário e o seu 1/3 não têm INSS nem IRRF. O IRRF das férias é calculado à parte do salário.
 */
export function calcularReciboFerias(p: {
  remuneracao: number
  media: { media: number; meses: number }
  dias: number
  abono: number
  dependentes: number
  encargos: boolean
  inicio: string
  fim: string
  pagamentoEm: string
}): ReciboFerias {
  const valorDia = p.remuneracao / 30
  const ferias = c(valorDia * p.dias)
  const mediaFerias = c((p.media.media / 30) * p.dias)
  const terco = c((ferias + mediaFerias) / 3)
  const abonoValor = c(((p.remuneracao + p.media.media) / 30) * p.abono)
  const tercoAbono = c(abonoValor / 3)
  const tributavel = c(ferias + mediaFerias + terco)
  const inss = p.encargos ? calcInss(tributavel) : 0
  const irrf = p.encargos ? calcIrrf(tributavel, inss, p.dependentes) : 0
  const liquido = c(tributavel + abonoValor + tercoAbono - inss - irrf)

  const doc = documento('Recibo de férias', [
    { descricao: 'Férias', referencia: plural(p.dias, 'dia', 'dias'), provento: ferias, desconto: 0 },
    { descricao: 'Média de variáveis', referencia: plural(p.media.meses, 'mês', 'meses'), provento: mediaFerias, desconto: 0 },
    { descricao: '1/3 de férias', referencia: '', provento: terco, desconto: 0 },
    { descricao: 'Abono pecuniário', referencia: plural(p.abono, 'dia', 'dias'), provento: abonoValor, desconto: 0 },
    { descricao: '1/3 do abono pecuniário', referencia: '', provento: tercoAbono, desconto: 0 },
    { descricao: 'INSS sobre férias', referencia: '', provento: 0, desconto: inss },
    { descricao: 'IRRF sobre férias', referencia: '', provento: 0, desconto: irrf },
  ], liquido, [
    { rotulo: 'Base INSS', valor: tributavel },
    { rotulo: 'Base IRRF', valor: c(tributavel - inss) },
    { rotulo: 'Abono (sem INSS e IRRF)', valor: c(abonoValor + tercoAbono) },
  ], [
    `Gozo de ${fmtDataBr(p.inicio)} a ${fmtDataBr(p.fim)}, pago até 2 dias antes do início (art. 145 da CLT).`,
    ...(p.media.meses ? [`Média de horas extras, adicional noturno, DSR e comissões dos últimos ${plural(p.media.meses, 'mês fechado', 'meses fechados')}.`] : []),
  ])

  return { ...doc, resumo: { dias: p.dias, abono: p.abono, inicio: p.inicio, fim: p.fim, pagamentoEm: p.pagamentoEm, ferias: c(ferias + mediaFerias), terco, abonoValor: c(abonoValor + tercoAbono), inss, irrf } }
}

// ── 13º salário ───────────────────────────────────────────────────────────────

const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

/**
 * Avos do 13º (Lei 4.090/62): conta o mês com 15 dias ou mais de trabalho.
 * faltasPorMes: faltas sem justificativa por mês (1 a 12), das folhas fechadas.
 */
export function avosDecimo(ano: number, ateMes: number, admissao: string | null, faltasPorMes: Record<number, number> = {}) {
  let avos = 0
  for (let m = 1; m <= ateMes; m++) {
    const fim = `${ano}-${String(m).padStart(2, '0')}-${String(ultimoDia(ano, m)).padStart(2, '0')}`
    if (admissao && admissao > fim) continue
    const primeiro = admissao && admissao.slice(0, 7) === fim.slice(0, 7) ? Number(admissao.slice(8, 10)) : 1
    const dias = ultimoDia(ano, m) - primeiro + 1 - (faltasPorMes[m] ?? 0)
    if (dias >= 15) avos++
  }
  return avos
}

export type ReciboDecimo = DocumentoHolerite & {
  resumo: { parcela: 1 | 2; avos: number; base: number; integral: number; valor: number; primeira: number; inss: number; irrf: number; fgts: number; pagamentoEm: string }
}

/**
 * 1ª parcela (até 30/11): metade do valor proporcional, sem INSS e IRRF.
 * 2ª parcela (até 20/12): valor integral menos a 1ª, com INSS e IRRF calculados só sobre o 13º.
 */
export function calcularDecimo(p: {
  parcela: 1 | 2
  ano: number
  remuneracao: number
  media: { media: number; meses: number }
  avos: number
  /** Valor da 1ª parcela já paga (na 2ª) */
  primeira: number
  dependentes: number
  fgtsPct: number
  pagamentoEm: string
}): ReciboDecimo {
  const base = c(p.remuneracao + p.media.media)
  const integral = c((base * p.avos) / 12)
  const salarioAvos = c((p.remuneracao * p.avos) / 12)
  const mediaAvos = c(integral - salarioAvos)
  const ref = `${p.avos}/12`
  const obsMedia = p.media.meses ? [`Inclui a média de horas extras, adicional noturno, DSR e comissões de ${plural(p.media.meses, 'mês fechado', 'meses fechados')} de ${p.ano}.`] : []

  if (p.parcela === 1) {
    const valor = c(integral / 2)
    const fgts = c(valor * (p.fgtsPct / 100))
    const doc = documento('13º salário · 1ª parcela', [
      { descricao: '13º salário — 1ª parcela', referencia: ref, provento: valor, desconto: 0 },
    ], valor, [
      { rotulo: 'Valor integral previsto', valor: integral },
      { rotulo: 'Base FGTS', valor },
      { rotulo: 'FGTS', valor: fgts },
    ], [`Adiantamento de metade do 13º, sem INSS e IRRF, que são descontados na 2ª parcela.`, ...obsMedia])
    return { ...doc, resumo: { parcela: 1, avos: p.avos, base, integral, valor, primeira: 0, inss: 0, irrf: 0, fgts, pagamentoEm: p.pagamentoEm } }
  }

  const inss = calcInss(integral)
  const irrf = calcIrrf(integral, inss, p.dependentes)
  const liquido = Math.max(0, c(integral - p.primeira - inss - irrf))
  const fgts = c(Math.max(0, integral - p.primeira) * (p.fgtsPct / 100))
  const doc = documento('13º salário · 2ª parcela', [
    { descricao: '13º salário', referencia: ref, provento: salarioAvos, desconto: 0 },
    { descricao: 'Média de variáveis no 13º', referencia: ref, provento: mediaAvos, desconto: 0 },
    { descricao: 'Adiantamento da 1ª parcela', referencia: '', provento: 0, desconto: p.primeira },
    { descricao: 'INSS sobre 13º', referencia: '', provento: 0, desconto: inss },
    { descricao: 'IRRF sobre 13º', referencia: '', provento: 0, desconto: irrf },
  ], liquido, [
    { rotulo: 'Base INSS', valor: integral },
    { rotulo: 'Base IRRF', valor: c(integral - inss) },
    { rotulo: 'FGTS', valor: fgts },
  ], ['INSS e IRRF calculados só sobre o 13º, separados do salário do mês.', ...obsMedia])
  return { ...doc, resumo: { parcela: 2, avos: p.avos, base, integral, valor: integral, primeira: p.primeira, inss, irrf, fgts, pagamentoEm: p.pagamentoEm } }
}
