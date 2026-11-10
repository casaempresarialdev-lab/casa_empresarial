import { describe, expect, it } from 'vitest'
import { apurarPonto, calcIrrf, calcInss, calcularFolha, divisorHoras, horas } from '@/lib/folha/calculo'
import { mesclarBatidas, minutosTrabalhados } from '@/lib/ponto'
import type { DayResult, ScheduleRule } from '@/lib/escala/generate'

// Apuração do ponto e valores da folha do mês

const dia = (date: string, extra: Partial<DayResult> = {}) => ({
  date, tipo: 'trabalho', hora_entrada: '08:00', hora_saida: '17:00', hora_almoco_inicio: '12:00', hora_almoco_fim: '13:00',
  feriado: false, feriado_nome: null, domingo: false, excecao: false, rule_id: 'r', ...extra,
}) as DayResult
const carimbo = (data: string, h: string) => `${data}T${h}:00-03:00`
const reg = (data: string, e: string, s: string | null, { semAlmoco = false, tipo = 'normal' } = {}) => {
  const h = s ? (semAlmoco ? [e, s] : [e, '12:00', '13:00', s]) : (semAlmoco ? [e] : [e, '12:00', '13:00'])
  return { data, tipo, batidas: h.map((x) => ({ em: carimbo(data, x) })) }
}
const op = { hoje: '2026-11-10', admissao: null, controlaPonto: true }

describe('tabelas de 2026', () => {
  it('INSS progressivo', () => {
    expect(calcInss(3000)).toBe(248.6)
    expect(calcInss(20000)).toBe(988.09)
  })
  it('IRRF com a redução da Lei 15.270/2025', () => {
    expect(calcIrrf(5000, calcInss(5000), 0)).toBe(0)
    expect(calcIrrf(6000, calcInss(6000), 0)).toBe(385.1)
    expect(calcIrrf(2000, calcInss(2000), 0)).toBe(0)
  })
})

describe('divisor de horas', () => {
  it('40h semanais → 200; sem escala → 220', () => {
    const regra = { hora_entrada: '08:00', hora_saida: '17:00', hora_almoco_inicio: '12:00', hora_almoco_fim: '13:00', tipo_escala: 'semanal', dias_folga: [0, 6], ciclo_trabalho_dias: null, ciclo_folga_dias: null } as unknown as ScheduleRule
    expect(divisorHoras(regra)).toBe(200)
    expect(divisorHoras(null)).toBe(220)
  })
})

describe('apuração do ponto', () => {
  const dias = [
    dia('2026-11-02', { feriado: true }), // feriado sem ponto: não é falta
    dia('2026-11-03'), // normal
    dia('2026-11-04'), // 8 min de atraso: dentro da tolerância
    dia('2026-11-05'), // 45 min de atraso
    dia('2026-11-06'), // 1h30 extra
    dia('2026-11-07', { tipo: 'folga' }), // folga trabalhada
    dia('2026-11-08', { tipo: 'folga', domingo: true }),
    dia('2026-11-09'), // falta (sem ponto)
    dia('2026-11-10'), // hoje sem ponto: ainda não é falta
    dia('2026-11-11'), // futuro
  ]
  const regs = [
    reg('2026-11-03', '08:00', '17:00'), reg('2026-11-04', '08:08', '17:00'), reg('2026-11-05', '08:45', '17:00'),
    reg('2026-11-06', '08:00', '18:30'), reg('2026-11-07', '08:00', '12:00', { semAlmoco: true }),
    reg('2026-11-08', '08:00', '10:00', { semAlmoco: true }),
  ]
  const a = apurarPonto(dias, regs, op)

  it('faltas, atrasos e horas extras', () => {
    expect(a.faltas).toBe(1)
    expect(a.atrasoMin).toBe(45)
    expect(a.he50Min).toBe(330) // 1h30 + folga de 4h
    expect(a.heDomingoMin).toBe(120)
    expect(a.diasEscala).toBe(7)
    expect(a.diasTrabalhados).toBe(6)
  })
  it('casos que não viram falta', () => {
    expect(apurarPonto(dias, regs, { ...op, controlaPonto: false }).motivo).toBe('sem_controle')
    expect(apurarPonto(dias, [], op).motivo).toBe('sem_registros')
    expect(apurarPonto([dia('2026-11-03')], [{ data: '2026-11-03', batidas: [], tipo: 'atestado' }], op).faltas).toBe(0)
    expect(apurarPonto([dia('2026-11-03'), dia('2026-11-04')], [reg('2026-11-04', '08:00', '17:00')], { ...op, admissao: '2026-11-04' }).faltas).toBe(0)
  })
  it('número ímpar de registros fica pendente', () => {
    expect(apurarPonto([dia('2026-11-03')], [reg('2026-11-03', '08:00', null)], op).incompletos).toBe(1)
  })
  it('feriado, 12x36, tolerância e afastamento', () => {
    const d12 = (date: string, extra: Partial<DayResult> = {}) => dia(date, { hora_entrada: '07:00', hora_saida: '19:00', hora_almoco_inicio: null, hora_almoco_fim: null, ...extra })
    const r12 = (data: string, x: string, y: string) => ({ data, tipo: 'normal', batidas: [{ em: carimbo(data, x) }, { em: carimbo(data, y) }] })
    const opMes = { ...op, hoje: '2026-11-30' }
    const f = [d12('2026-11-02', { feriado: true })]
    const r = [r12('2026-11-02', '07:00', '19:00')]
    expect(apurarPonto(f, r, opMes).heFeriadoMin).toBe(720)
    expect(apurarPonto(f, r, { ...opMes, feriadoCompensado: true }).heFeriadoMin).toBe(0)
    expect(apurarPonto([d12('2026-11-03')], [r12('2026-11-03', '07:00', '19:20')], { ...opMes, tolerancia: 30 }).he50Min).toBe(0)
    expect(apurarPonto([d12('2026-11-03')], [r12('2026-11-03', '07:00', '19:20')], opMes).he50Min).toBe(20)
    expect(apurarPonto(f, r, { ...opMes, afastado: true }).motivo).toBe('afastado')
  })
})

describe('registros livres', () => {
  const horarios = (h: string[]) => h.map((x) => carimbo('2026-11-03', x))
  it('soma cada par entrada/saída', () => {
    expect(minutosTrabalhados(horarios(['08:00', '10:00', '10:30', '12:00', '13:00', '17:00']))).toBe(450)
    expect(minutosTrabalhados(horarios(['08:00', '12:00', '13:00']))).toBe(240)
  })
  it('6 registros na folha e 5 = incompleto', () => {
    const seis = { data: '2026-11-03', tipo: 'normal', batidas: horarios(['08:00', '10:00', '10:30', '12:00', '13:00', '17:30']).map((em) => ({ em })) }
    const a6 = apurarPonto([dia('2026-11-03')], [seis], op)
    expect([a6.he50Min, a6.atrasoMin, a6.diasTrabalhados]).toEqual([0, 0, 1])
    const cinco = { ...seis, batidas: seis.batidas.slice(0, 5) }
    expect(apurarPonto([dia('2026-11-03')], [cinco], op).incompletos).toBe(1)
  })
  it('mesclar mantém a origem do horário que não mudou', () => {
    const antigas = [{ em: '2026-11-03T11:00:27.000Z', origem: { ip: '1.1.1.1' } }, { em: '2026-11-03T15:00:10.000Z', origem: { ip: '2.2.2.2' } }]
    const novas = mesclarBatidas(antigas as never, horarios(['08:00', '13:00', '17:00']))
    expect(novas.map((b) => (b.origem as { ip?: string } | null)?.ip ?? null)).toEqual(['1.1.1.1', null, null])
  })
})

describe('valores do mês', () => {
  const dias = [dia('2026-11-03'), dia('2026-11-05'), dia('2026-11-06'), dia('2026-11-07', { tipo: 'folga' }), dia('2026-11-08', { tipo: 'folga', domingo: true }), dia('2026-11-09')]
  const regs = [reg('2026-11-03', '08:00', '17:00'), reg('2026-11-05', '08:45', '17:00'), reg('2026-11-06', '08:00', '18:30'), reg('2026-11-07', '08:00', '12:00', { semAlmoco: true }), reg('2026-11-08', '08:00', '10:00', { semAlmoco: true })]
  const a = apurarPonto(dias, regs, op)
  const vt = { valor: 10, por_dia_trabalhado: true, desconto_tipo: 'percentual_salario', desconto_valor: 6 }
  const ins = { salario: 3000, tipoContrato: 'clt', temPericulosidade: false, dependentes: 0, divisor: 200, fgtsPct: 8, outrosEncargosPct: 0, beneficios: [{ nome: 'Vale Transporte', beneficio: vt as never, valorPessoa: null }] }

  it('horas extras, atrasos, faltas e bruto', () => {
    const r = calcularFolha(ins, a, {})
    expect(r.automaticos.horas_extras).toBe(123.75) // 5h30 × 15 × 1,5
    expect(r.automaticos.horas_extras_domingo).toBe(60) // 2h × 15 × 2
    expect(r.automaticos.desconto_atrasos).toBe(11.25) // 45 min × 15
    expect(r.valorFaltas).toBe(100)
    expect(r.bruto).toBe(3072.5)
  })
  it('a edição na conferência prevalece; PJ sem INSS', () => {
    expect(calcularFolha(ins, a, { bonus: 200, desconto_faltas: 0 }).bruto).toBe(3372.5)
    expect(calcularFolha({ ...ins, tipoContrato: 'pj' }, a, {}).inss).toBe(0)
  })
  it('formato de horas', () => {
    expect(horas(200)).toBe('3h20')
  })
})
