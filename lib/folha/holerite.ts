// Linhas do holerite e dos recibos (férias e 13º). Puro: a soma das linhas fecha com o líquido.

import { calcularFolha, horas, type AjustesFolha, type ApuracaoPonto, type InsumosFolha } from '@/lib/folha/calculo'
import { fmtDataBr } from '@/lib/folha/config'

export type LinhaHolerite = { descricao: string; referencia: string; provento: number; desconto: number }

/** O que o PDF mostra: serve para a folha mensal, o recibo de férias e as parcelas do 13º */
export type DocumentoHolerite = {
  titulo: string
  linhas: LinhaHolerite[]
  totalProventos: number
  totalDescontos: number
  liquido: number
  bases: { rotulo: string; valor: number }[]
  observacoes: string[]
}

const c = (v: number) => Math.round(v * 100) / 100
const pct = (fator: number | undefined, padrao: number) => Math.round(((fator ?? padrao) - 1) * 100)
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Tira as linhas zeradas e soma os totais */
export function documento(titulo: string, candidatas: LinhaHolerite[], liquido: number, bases: DocumentoHolerite['bases'], observacoes: string[] = []): DocumentoHolerite {
  const linhas = candidatas.filter((l) => l.provento > 0 || l.desconto > 0)
  return {
    titulo,
    linhas,
    totalProventos: c(linhas.reduce((t, l) => t + l.provento, 0)),
    totalDescontos: c(linhas.reduce((t, l) => t + l.desconto, 0)),
    liquido,
    bases,
    observacoes,
  }
}

export function montarHolerite(i: InsumosFolha, ponto: ApuracaoPonto, ajustes: AjustesFolha): DocumentoHolerite {
  const r = calcularFolha(i, ponto, ajustes)
  const v = r.valores
  const diasSalario = 30 - r.diasFerias
  // Com férias no mês, salário e adicionais saem proporcionais aos dias fora das férias
  const fator = Math.max(0, diasSalario) / 30
  const periculosidade = c(r.periculosidade * fator)
  const insalubridade = c(r.insalubridade * fator)
  const salario = c(r.remuneracao - r.valorDiasFerias - periculosidade - insalubridade)
  const legado = r.diasFerias - (r.feriasNoRecibo?.dias ?? 0)
  const noturnas = i.noturno ? Math.round((ponto.noturnoMin ?? 0) * (i.noturno.reduzida ? 60 / 52.5 : 1)) : 0

  const linhas: LinhaHolerite[] = [
    { descricao: 'Salário', referencia: `${diasSalario} dias`, provento: salario, desconto: 0 },
    { descricao: 'Adicional de periculosidade', referencia: '30%', provento: periculosidade, desconto: 0 },
    { descricao: 'Adicional de insalubridade', referencia: `${i.insalubridade?.pct ?? 0}%`, provento: insalubridade, desconto: 0 },
    { descricao: 'Férias', referencia: `${legado} dias`, provento: c(r.valorFerias - (r.feriasNoRecibo?.valor ?? 0)), desconto: 0 },
    { descricao: '1/3 de férias', referencia: '', provento: r.tercoFerias, desconto: 0 },
    { descricao: 'Abono de férias', referencia: `${i.diasAbono ?? 0} dias`, provento: r.abonoFerias, desconto: 0 },
    { descricao: `Hora extra ${pct(i.fatorHe?.normal, 1.5)}%`, referencia: horas(ponto.he50Min), provento: v.horas_extras, desconto: 0 },
    { descricao: `Hora extra feriado ${pct(i.fatorHe?.feriado, 2)}%`, referencia: horas(ponto.heFeriadoMin), provento: v.horas_extras_feriado, desconto: 0 },
    { descricao: `Hora extra domingo ${pct(i.fatorHe?.domingo, 2)}%`, referencia: horas(ponto.heDomingoMin), provento: v.horas_extras_domingo, desconto: 0 },
    { descricao: `Adicional noturno ${i.noturno?.pct ?? 20}%`, referencia: horas(noturnas), provento: v.adicional_noturno, desconto: 0 },
    { descricao: 'DSR sobre horas extras e adicional noturno', referencia: '', provento: r.dsr, desconto: 0 },
    { descricao: 'Comissão', referencia: '', provento: v.bonus, desconto: 0 },
    { descricao: 'Faltas', referencia: plural(v.desconto_faltas, 'dia', 'dias'), provento: 0, desconto: r.valorFaltas },
    { descricao: 'DSR perdido por falta', referencia: plural(v.dsr_perdido, 'dia', 'dias'), provento: 0, desconto: r.valorDsrPerdido },
    { descricao: 'Atrasos', referencia: horas(ponto.atrasoMin), provento: 0, desconto: v.desconto_atrasos },
    { descricao: 'INSS', referencia: '', provento: 0, desconto: r.inss },
    { descricao: 'IRRF', referencia: '', provento: 0, desconto: r.irrf },
    { descricao: 'Vale-transporte', referencia: '', provento: 0, desconto: v.desconto_vt },
    { descricao: 'Vale-alimentação/refeição', referencia: '', provento: 0, desconto: v.desconto_vr },
    { descricao: 'Outros benefícios', referencia: '', provento: 0, desconto: v.desconto_outros },
    { descricao: 'Adiantamento', referencia: '', provento: 0, desconto: v.desconto_adiantamento },
  ]

  const observacoes = r.feriasNoRecibo
    ? [`${plural(r.feriasNoRecibo.dias, 'dia', 'dias')} de férias neste mês, pagos no recibo de férias em ${fmtDataBr(r.feriasNoRecibo.pagamentoEm)}. O valor entra na base do INSS e do FGTS; o INSS já descontado no recibo foi abatido.`]
    : []

  return documento('Holerite', linhas, r.liquido, [
    { rotulo: 'Base INSS', valor: r.baseInss },
    { rotulo: 'Base FGTS', valor: r.baseInss },
    { rotulo: 'FGTS do mês', valor: r.fgts },
  ], observacoes)
}
