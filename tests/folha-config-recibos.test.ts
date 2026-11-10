import { describe, expect, it } from 'vitest'
import { apurarPonto, calcInss, calcIrrf, calcularFolha, minutosNoturnos, type ApuracaoPonto } from '@/lib/folha/calculo'
import { CONFIG_FOLHA_PADRAO as P, adicionalDaPessoa, diaBancarioAte, diasDsr, insalubridadeDoCargo, periodoApuracao, vencimentosFolha } from '@/lib/folha/config'
import { montarHolerite, type DocumentoHolerite } from '@/lib/folha/holerite'
import { avosDecimo, calcularDecimo, calcularReciboFerias, mediaVariaveis } from '@/lib/folha/recibos'
import { configFolhaSchema } from '@/lib/validations/folha'
import type { DayResult } from '@/lib/escala/generate'

// Configuração da folha, DSR, adicional noturno, insalubridade, recibo de férias e 13º

const c = (v: number) => Math.round(v * 100) / 100
const fecha = (doc: DocumentoHolerite) => c(doc.totalProventos - doc.totalDescontos) === doc.liquido
const t = (d: string, h: string) => `${d}T${h}:00-03:00`

const ponto: ApuracaoPonto = { motivo: null, diasEscala: 22, diasTrabalhados: 22, faltas: 0, atestados: 0, ferias: 0, atrasoMin: 0, he50Min: 120, heFeriadoMin: 60, heDomingoMin: 0, incompletos: 0, ocorrencias: [], noturnoMin: 60, semanasComFalta: 0 }
const ins = { salario: 3000, tipoContrato: 'clt', temPericulosidade: false, dependentes: 0, divisor: 200, fgtsPct: 8, outrosEncargosPct: 0, beneficios: [] }
const semVariaveis = { ...ponto, he50Min: 0, heFeriadoMin: 0, noturnoMin: 0 }

describe('período e vencimentos', () => {
  it('mês cheio e dia de corte', () => {
    expect(periodoApuracao('2026-11', P)).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(periodoApuracao('2026-11', { dia_corte: 20 })).toEqual({ inicio: '2026-10-21', fim: '2026-11-20' })
    expect(periodoApuracao('2027-01', { dia_corte: 25 })).toEqual({ inicio: '2026-12-26', fim: '2027-01-25' })
  })
  it('5º dia útil conta sábado e pula domingo e feriado', () => {
    expect(vencimentosFolha('2026-11', P, []).salario).toBe('2026-12-05')
    expect(vencimentosFolha('2026-12', P, []).salario).toBe('2027-01-07')
    expect(vencimentosFolha('2026-11', { ...P, pagamento_tipo: 'dia_fixo', pagamento_dia: 10 }, []).salario).toBe('2026-12-10')
  })
  it('guias antecipam para dia útil; benefícios vão com o salário', () => {
    expect(vencimentosFolha('2026-11', P, []).guias).toBe('2026-12-18')
    expect(vencimentosFolha('2026-11', P, []).beneficios).toBe('2026-12-05')
    expect(vencimentosFolha('2026-11', { ...P, beneficios_dia: 8 }, []).beneficios).toBe('2026-12-08')
  })
  it('prazos "até" no último dia bancário', () => {
    expect(diaBancarioAte('2026-12-20', [])).toBe('2026-12-18')
    expect(diaBancarioAte('2026-11-30', [])).toBe('2026-11-30')
  })
  it('configuração: dia de corte obrigatório no modo corte', () => {
    const cfg = { ...P, modo_periodo: 'corte', dia_corte: null, holerite_modo: 'sistema' }
    expect(configFolhaSchema.safeParse(cfg).success).toBe(false)
    expect(configFolhaSchema.safeParse({ ...cfg, dia_corte: 20 }).success).toBe(true)
    expect(configFolhaSchema.safeParse({ ...cfg, modo_periodo: 'mes' }).success).toBe(true)
  })
})

describe('horas extras, adiantamento e férias sem recibo (folhas antigas)', () => {
  it('percentuais configuráveis', () => {
    expect(calcularFolha(ins, ponto).automaticos.horas_extras).toBe(45)
    const f = calcularFolha({ ...ins, fatorHe: { normal: 1.6, feriado: 2.5, domingo: 2 } }, ponto).automaticos
    expect([f.horas_extras, f.horas_extras_feriado]).toEqual([48, 37.5])
  })
  it('adiantamento só para CLT', () => {
    expect(calcularFolha({ ...ins, adiantamentoPct: 40 }, ponto).automaticos.desconto_adiantamento).toBe(1200)
    expect(calcularFolha({ ...ins, tipoContrato: 'pj', adiantamentoPct: 40 }, ponto).automaticos.desconto_adiantamento).toBe(0)
  })
  it('férias dentro da folha: valor, 1/3 e abono fora da base', () => {
    const fer = calcularFolha({ ...ins, diasFerias: 30 }, semVariaveis)
    expect([fer.valorFerias, fer.tercoFerias, fer.bruto]).toEqual([3000, 1000, 4000])
    const parcial = calcularFolha({ ...ins, diasFerias: 10, diasAbono: 10 }, semVariaveis)
    expect([parcial.abonoFerias, parcial.bruto, parcial.fgts]).toEqual([1333.33, 3333.33, 266.67])
  })
  it('o holerite sempre fecha com o líquido', () => {
    expect(fecha(montarHolerite(ins, ponto, {}))).toBe(true)
    expect(fecha(montarHolerite({ ...ins, diasFerias: 10, diasAbono: 10, temPericulosidade: true }, ponto, {}))).toBe(true)
    expect(fecha(montarHolerite({ ...ins, adiantamentoPct: 40 }, ponto, { desconto_faltas: 2, bonus: 300 }))).toBe(true)
  })
  it('folha antiga, sem os campos novos, não muda', () => {
    expect(calcularFolha(ins, ponto).bruto).toBe(3075)
    expect(calcularFolha(ins, ponto).automaticos.adicional_noturno).toBe(0)
  })
})

describe('adicional noturno', () => {
  it('minutos na faixa noturna', () => {
    expect(minutosNoturnos([t('2026-11-03', '22:00'), t('2026-11-04', '06:00')], '22:00', '05:00')).toBe(420)
    expect(minutosNoturnos([t('2026-11-03', '20:00'), t('2026-11-03', '23:30')], '22:00', '05:00')).toBe(90)
    expect(minutosNoturnos([t('2026-11-03', '03:00'), t('2026-11-03', '08:00')], '22:00', '05:00')).toBe(120)
    expect(minutosNoturnos([t('2026-11-03', '08:00'), t('2026-11-03', '17:00')], '22:00', '05:00')).toBe(0)
  })
  it('apuração e semanas com falta', () => {
    const dia = (date: string) => ({ date, tipo: 'trabalho', hora_entrada: '14:00', hora_saida: '22:00', hora_almoco_inicio: null, hora_almoco_fim: null, feriado: false, feriado_nome: null, domingo: false, excecao: false, rule_id: 'r' }) as DayResult
    const reg = (data: string, a: string, b: string) => ({ data, tipo: 'normal', batidas: [{ em: t(data, a) }, { em: t(data, b) }] })
    const op = { hoje: '2026-11-30', admissao: null, controlaPonto: true, noturno: { inicio: '22:00', fim: '05:00' } }
    const ap = apurarPonto(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10', '2026-11-17'].map(dia), [reg('2026-11-03', '14:00', '23:00'), reg('2026-11-10', '14:00', '22:00')], op)
    expect(ap.noturnoMin).toBe(60)
    expect([ap.faltas, ap.semanasComFalta]).toEqual([3, 2]) // 04 e 05 na mesma semana, 17 em outra
  })
  it('valor com e sem hora reduzida', () => {
    expect(calcularFolha({ ...ins, noturno: { pct: 20, reduzida: true } }, ponto).valores.adicional_noturno).toBe(3.43)
    expect(calcularFolha({ ...ins, noturno: { pct: 20, reduzida: false } }, ponto).valores.adicional_noturno).toBe(3)
  })
})

describe('DSR', () => {
  // Novembro/2026: 5 domingos + Finados (02) + Consciência Negra (20); 15/11 cai no domingo
  const dsrNov = diasDsr('2026-11-01', '2026-11-30', [])
  it('dias úteis e de descanso com feriados nacionais', () => {
    expect(dsrNov).toEqual({ diasUteis: 23, descansos: 7 })
  })
  it('reflexo das horas extras e do noturno', () => {
    const r = calcularFolha({ ...ins, noturno: { pct: 20, reduzida: true }, dsr: { ...dsrNov, reflexo: true, descontaFalta: true } }, ponto)
    expect(r.dsr).toBe(23.87) // (45 + 30 + 3,43) / 23 × 7
    expect(r.bruto).toBe(c(3000 + 45 + 30 + 3.43 + 23.87))
  })
  it('falta sem justificativa perde o DSR da semana', () => {
    const r = calcularFolha({ ...ins, dsr: { ...dsrNov, reflexo: false, descontaFalta: true } }, { ...semVariaveis, faltas: 1, semanasComFalta: 1 })
    expect([r.valorFaltas, r.valorDsrPerdido, r.bruto]).toEqual([100, 100, 2800])
    expect(calcularFolha({ ...ins, dsr: { ...dsrNov, reflexo: false, descontaFalta: false } }, { ...ponto, faltas: 1, semanasComFalta: 1 }).valorDsrPerdido).toBe(0)
  })
})

describe('adicionais de risco', () => {
  it('a exceção da ficha vence o cargo', () => {
    expect(adicionalDaPessoa({ adicional_risco: null }, 'insalubridade_20')).toBe('insalubridade_20')
    expect(adicionalDaPessoa({ adicional_risco: 'nenhum' }, 'insalubridade_20')).toBe('nenhum')
    expect(adicionalDaPessoa({ tem_periculosidade: true }, null)).toBe('periculosidade')
    expect(adicionalDaPessoa({ adicional_risco: null, tem_periculosidade: true }, null)).toBe('nenhum')
  })
  it('insalubridade sobre o mínimo ou o salário', () => {
    expect(insalubridadeDoCargo('insalubridade_20', P, 3000)).toEqual({ pct: 20, valor: 324.2 })
    expect(insalubridadeDoCargo('insalubridade_10', { ...P, insalubridade_base: 'salario_base' }, 3000)).toEqual({ pct: 10, valor: 300 })
    expect(insalubridadeDoCargo('insalubridade_40', P, 3000, 0.5)?.valor).toBe(324.2)
  })
  it('entra na remuneração e não acumula com periculosidade', () => {
    const r = calcularFolha({ ...ins, insalubridade: { pct: 20, valor: 324.2 } }, semVariaveis)
    expect([r.insalubridade, r.remuneracao, r.bruto]).toEqual([324.2, 3324.2, 3324.2])
    const ambos = calcularFolha({ ...ins, temPericulosidade: true, insalubridade: { pct: 20, valor: 324.2 } }, ponto)
    expect([ambos.periculosidade, ambos.insalubridade]).toEqual([900, 0])
    const maior = calcularFolha({ ...ins, salario: 1000, temPericulosidade: true, insalubridade: { pct: 40, valor: 648.4 } }, ponto)
    expect([maior.periculosidade, maior.insalubridade]).toEqual([0, 648.4])
  })
})

describe('recibo de férias', () => {
  const base = { remuneracao: 3000, dependentes: 0, encargos: true, inicio: '2026-12-01', pagamentoEm: '2026-11-27' }
  it('30 dias com 1/3 e IRRF em separado', () => {
    const r = calcularReciboFerias({ ...base, media: { media: 0, meses: 0 }, dias: 30, abono: 0, fim: '2026-12-30' })
    expect([r.resumo.ferias, r.resumo.terco, r.resumo.inss]).toEqual([3000, 1000, calcInss(4000)])
    expect(r.resumo.irrf).toBe(calcIrrf(4000, calcInss(4000), 0))
    expect(fecha(r)).toBe(true)
  })
  it('com média de variáveis e abono pecuniário fora do INSS', () => {
    const r = calcularReciboFerias({ ...base, media: { media: 300, meses: 12 }, dias: 20, abono: 10, dependentes: 1, fim: '2026-12-20' })
    expect([r.resumo.ferias, r.resumo.terco, r.resumo.abonoValor]).toEqual([2200, 733.33, 1466.67])
    expect(r.resumo.inss).toBe(calcInss(2933.33))
    expect(fecha(r)).toBe(true)
  })
  it('PJ sem INSS', () => {
    expect(calcularReciboFerias({ ...base, encargos: false, media: { media: 0, meses: 0 }, dias: 30, abono: 0, fim: '2026-12-30' }).resumo.inss).toBe(0)
  })
  it('na folha do mês: salário só dos outros dias e INSS do recibo abatido', () => {
    const recibo = { dias: 20, valor: 2200, terco: 733.33, inss: calcInss(2933.33), pagamentoEm: '2026-11-27' }
    const mes = calcularFolha({ ...ins, feriasRecibo: recibo }, semVariaveis)
    expect(mes.bruto).toBe(1000)
    expect(mes.baseInss).toBe(c(1000 + 2200 + 733.33))
    expect(mes.inss).toBe(c(calcInss(3933.33) - recibo.inss))
    expect(mes.fgts).toBe(c(3933.33 * 0.08))
    expect(mes.liquido).toBe(c(1000 - mes.inss - mes.irrf))
    expect(fecha(montarHolerite({ ...ins, feriasRecibo: recibo }, ponto, {}))).toBe(true)
  })
})

describe('13º salário', () => {
  it('avos: mês com 15 dias ou mais de trabalho', () => {
    expect(avosDecimo(2026, 12, '2020-05-10')).toBe(12)
    expect(avosDecimo(2026, 12, '2026-02-16')).toBe(10)
    expect(avosDecimo(2026, 12, '2026-02-14')).toBe(11)
    expect(avosDecimo(2026, 11, '2026-03-01')).toBe(9)
    expect(avosDecimo(2026, 12, '2020-01-01', { 3: 17 })).toBe(11)
    expect(avosDecimo(2026, 12, '2027-01-05')).toBe(0)
  })
  it('1ª parcela: metade, sem INSS e IRRF', () => {
    const p1 = calcularDecimo({ parcela: 1, ano: 2026, remuneracao: 3000, media: { media: 0, meses: 0 }, avos: 12, primeira: 0, dependentes: 0, fgtsPct: 8, pagamentoEm: '2026-11-30' })
    expect([p1.resumo.valor, p1.liquido, p1.resumo.inss, p1.resumo.fgts]).toEqual([1500, 1500, 0, 120])
  })
  it('2ª parcela: integral menos a 1ª, com INSS e IRRF só do 13º', () => {
    const p2 = calcularDecimo({ parcela: 2, ano: 2026, remuneracao: 3000, media: { media: 0, meses: 0 }, avos: 12, primeira: 1500, dependentes: 0, fgtsPct: 8, pagamentoEm: '2026-12-18' })
    expect([p2.resumo.integral, p2.resumo.inss, p2.liquido, p2.resumo.fgts]).toEqual([3000, 248.6, 1251.4, 120])
    expect(fecha(p2)).toBe(true)
    const p2m = calcularDecimo({ parcela: 2, ano: 2026, remuneracao: 6000, media: { media: 600, meses: 10 }, avos: 9, primeira: 2475, dependentes: 0, fgtsPct: 8, pagamentoEm: '2026-12-18' })
    expect([p2m.resumo.base, p2m.resumo.integral]).toEqual([6600, 4950])
    expect(fecha(p2m)).toBe(true)
  })
  it('média das variáveis das folhas fechadas', () => {
    expect(mediaVariaveis([{ insumos: ins, ponto, ajustes: {} }, { insumos: ins, ponto: { ...ponto, he50Min: 0, heFeriadoMin: 0 }, ajustes: { bonus: 100 } }])).toEqual({ media: 87.5, meses: 2 })
  })
})
