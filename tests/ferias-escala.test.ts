import { describe, expect, it } from 'vitest'
import { calcularPeriodos, validarFerias, type ConfigFerias, type FeriasRegistro } from '@/lib/ferias/regras'
import { feriadoDoDia, type FeriadoEmpresa } from '@/lib/escala/feriados'
import { generateMonth, tipoDaRegra, type ScheduleRule } from '@/lib/escala/generate'
import { periodoDoMes, somarDias } from '@/lib/escala/periodo'
import { padraoEscalaSchema } from '@/lib/validations/escala'
import { ausenciaSchema } from '@/lib/validations/ausencias'
import { feriasSchema } from '@/lib/validations/ferias'

// Regras de férias (CLT), escala de trabalho e feriados

const hoje = '2026-11-10'
const cfg: ConfigFerias = { ferias_solicitacao_ativa: true, ferias_antecedencia_dias: 30, ferias_permite_fracionar: true, ferias_permite_abono: true }
const f = (id: string, inicio: string, dias: number, extra: Partial<FeriasRegistro> = {}) =>
  ({ id, data_inicio: inicio, dias, dias_abono: 0, status: 'aprovada', periodo_inicio: '2025-03-15', ...extra }) as FeriasRegistro

describe('períodos aquisitivos', () => {
  // Admitido em 15/03/2024: o 1º período já venceu; o 2º está em concessão; o 3º em aquisição
  const ps = calcularPeriodos('2024-03-15', hoje, [])
  it('só os que ainda importam', () => {
    expect(ps.map((p) => [p.inicio, p.fim, p.concessivoFim, p.situacao])).toEqual([
      ['2025-03-15', '2026-03-14', '2027-03-14', 'disponivel'],
      ['2026-03-15', '2027-03-14', '2028-03-14', 'em_aquisicao'],
    ])
    expect(ps[1].mesesAdquiridos).toBe(7)
  })
  it('vencendo perto do prazo, sem admissão, recém-admitido', () => {
    expect(calcularPeriodos('2024-12-20', hoje, [])[0].situacao).toBe('vencendo')
    expect(calcularPeriodos(null, hoje, [])).toEqual([])
    expect(calcularPeriodos('2026-06-01', hoje, []).map((p) => p.situacao)).toEqual(['em_aquisicao'])
  })
  it('usados, reservados e saldo; canceladas não contam', () => {
    const com = calcularPeriodos('2024-03-15', hoje, [f('a', '2026-04-01', 14), f('b', '2026-12-01', 5, { status: 'solicitada' }), f('c', '2026-05-01', 10, { status: 'cancelada' })])
    expect([com[0].usados, com[0].reservados, com[0].saldo, com[0].fracoes, com[0].temFracaoLonga]).toEqual([14, 5, 11, 2, true])
  })
  it('férias antigas sem período são atribuídas pela data', () => {
    const antiga = calcularPeriodos('2024-03-15', hoje, [f('x', '2026-07-01', 30, { periodo_inicio: null })])
    expect([antiga[0].saldo, antiga[0].situacao]).toEqual([0, 'concluido'])
  })
})

describe('validação do pedido de férias', () => {
  const ps = calcularPeriodos('2024-03-15', hoje, [])
  const v = (pedido: { inicio: string; dias: number; abono: number }, extra: Record<string, unknown> = {}) =>
    validarFerias({ periodo: ps[0], pedido, config: cfg, hoje, origem: 'colaborador', ...extra } as Parameters<typeof validarFerias>[0])

  it('pedidos válidos', () => {
    expect(v({ inicio: '2027-01-11', dias: 30, abono: 0 })).toBeNull()
    expect(v({ inicio: '2027-01-11', dias: 20, abono: 10 })).toBeNull()
    expect(v({ inicio: '2027-01-11', dias: 10, abono: 0 })).toBeNull() // deixa 20: ainda cabe a parte de 14
  })
  it('antecedência vale para o colaborador, não para o gestor', () => {
    expect(v({ inicio: '2026-11-20', dias: 30, abono: 0 })).toContain('antecedência')
    expect(v({ inicio: '2026-11-20', dias: 30, abono: 0 }, { origem: 'gestor' })).toBeNull()
  })
  it('limites da CLT', () => {
    expect(v({ inicio: '2027-03-20', dias: 30, abono: 0 })).toContain('até 14/03/2027')
    expect(v({ inicio: '2027-01-11', dias: 30, abono: 5 })).toContain('saldo')
    expect(v({ inicio: '2027-01-11', dias: 4, abono: 0 })).toContain('5 dias')
    expect(v({ inicio: '2027-01-11', dias: 10, abono: 10 })).toContain('14 dias')
    expect(v({ inicio: '2027-01-11', dias: 27, abono: 0 })).toContain('Sobrariam 3')
    expect(v({ inicio: '2027-01-11', dias: 30, abono: 0 }, { diasSeguintes: [{ feriado: false, folga: false }, { feriado: true, folga: false }] })).toContain('2 dias antes')
  })
  it('a última parte precisa usar o saldo', () => {
    const terceira = calcularPeriodos('2024-03-15', hoje, [f('a', '2026-04-01', 14), f('b', '2026-06-01', 6)])[0]
    const vt = (dias: number) => validarFerias({ periodo: terceira, pedido: { inicio: '2027-01-11', dias, abono: 0 }, config: cfg, hoje, origem: 'colaborador' })
    expect(vt(5)).toContain('última parte')
    expect(vt(10)).toBeNull()
  })
  it('regras da empresa: dividir e vender', () => {
    expect(v({ inicio: '2027-01-11', dias: 15, abono: 0 }, { config: { ...cfg, ferias_permite_fracionar: false } })).toContain('de uma vez')
    expect(v({ inicio: '2027-01-11', dias: 20, abono: 10 }, { config: { ...cfg, ferias_permite_abono: false } })).toContain('vender')
  })
  it('colaborador não pede no período em aquisição', () => {
    expect(validarFerias({ periodo: ps[1], pedido: { inicio: '2027-01-11', dias: 30, abono: 0 }, config: cfg, hoje, origem: 'colaborador' })).toContain('só podem começar depois')
  })
  it('formulários', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const fe = { employee_id: id, periodo_inicio: '2025-03-15', data_inicio: '2026-12-01', dias: 20, dias_abono: 10, observacao: '' }
    expect(feriasSchema.safeParse(fe).success).toBe(true)
    expect(feriasSchema.safeParse({ ...fe, dias: 31 }).success).toBe(false)
    expect(feriasSchema.safeParse({ ...fe, periodo_inicio: '' }).success).toBe(false)
    expect(ausenciaSchema.safeParse({ tipo: 'atestado', data_inicio: '2026-11-03', data_fim: '2026-11-05', motivo: '' }).success).toBe(true)
    expect(ausenciaSchema.safeParse({ tipo: 'atestado', data_inicio: '2026-11-05', data_fim: '2026-11-03', motivo: '' }).success).toBe(false)
  })
})

describe('escala de trabalho', () => {
  const base = { id: 'r1', employee_id: 'e', data_inicio: '2026-11-01', data_fim: null, hora_entrada: '08:00', hora_saida: '17:00', hora_almoco_inicio: '12:00', hora_almoco_fim: '13:00', tipo_escala: 'semanal', dias_folga: [0, 6], data_referencia: null, ciclo_trabalho_dias: null, ciclo_folga_dias: null, folga_patterns: [] } as unknown as ScheduleRule
  const regra = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as unknown as ScheduleRule

  it('padrão semanal e vigência', () => {
    expect(tipoDaRegra([base], '2026-11-07')).toBe('folga')
    expect(tipoDaRegra([base], '2026-11-09')).toBe('trabalho')
    expect(tipoDaRegra([base], '2026-10-30')).toBe('sem_regra')
    const nova = regra({ id: 'r2', data_inicio: '2026-11-15', dias_folga: [1] })
    expect(['2026-11-09', '2026-11-16', '2026-11-21'].map((d) => tipoDaRegra([base, nova], d))).toEqual(['trabalho', 'folga', 'trabalho'])
  })
  it('ciclos e contagem a partir da referência', () => {
    const seis = regra({ tipo_escala: 'ciclo', dias_folga: [], data_referencia: '2026-11-01', ciclo_trabalho_dias: 6, ciclo_folga_dias: 1 })
    expect(['2026-11-06', '2026-11-07', '2026-11-08'].map((d) => tipoDaRegra([seis], d))).toEqual(['trabalho', 'folga', 'trabalho'])
    const editada = regra({ data_inicio: '2026-11-10', hora_almoco_inicio: null, hora_almoco_fim: null, tipo_escala: 'ciclo', dias_folga: [], data_referencia: '2026-11-01', ciclo_trabalho_dias: 6, ciclo_folga_dias: 1 })
    expect(['2026-11-13', '2026-11-14', '2026-11-15'].map((d) => tipoDaRegra([editada], d))).toEqual(['trabalho', 'folga', 'trabalho'])
  })
  it('expiração: a escala antiga encerrada não volta', () => {
    const ciclo = regra({ hora_almoco_inicio: null, hora_almoco_fim: null, tipo_escala: 'ciclo', dias_folga: [], data_referencia: '2026-11-01', ciclo_trabalho_dias: 7, ciclo_folga_dias: 7 })
    const expira = regra({ ...ciclo, data_fim: '2026-11-20' })
    expect([tipoDaRegra([expira], '2026-11-20'), tipoDaRegra([expira], '2026-11-21')]).toEqual(['trabalho', 'sem_regra'])
    const velha = regra({ ...ciclo, id: 'v', data_inicio: '2026-01-01', data_fim: somarDias('2026-11-01', -1), data_referencia: '2026-01-01' })
    expect(tipoDaRegra([velha, expira], '2026-11-25')).toBe('sem_regra')
  })
  it('trocas avulsas', () => {
    const dias = generateMonth([base], [
      { id: 'x', employee_id: 'e', data: '2026-11-07', tipo: 'trabalho', observacao: null },
      { id: 'y', employee_id: 'e', data: '2026-11-09', tipo: 'folga', observacao: null },
    ] as never, 11, 2026, 'e')
    const sab = dias.find((d) => d.date === '2026-11-07')!
    expect([sab.tipo, sab.hora_entrada, sab.hora_saida, sab.hora_almoco_inicio]).toEqual(['trabalho', '08:00', '17:00', '12:00'])
    const seg = dias.find((d) => d.date === '2026-11-09')!
    expect([seg.tipo, seg.hora_entrada]).toEqual(['folga', null])
  })
  it('formulário da escala', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const padrao = { employee_ids: [id], data_inicio: '2026-11-01', tipo_escala: 'semanal', dias_folga: [0], ciclo_trabalho_dias: null, ciclo_folga_dias: null, hora_entrada: '08:00', hora_saida: '17:00', hora_almoco_inicio: null, hora_almoco_fim: null }
    expect(padraoEscalaSchema.safeParse(padrao).success).toBe(true)
    expect(padraoEscalaSchema.safeParse({ ...padrao, hora_entrada: '22:00', hora_saida: '06:00' }).success).toBe(true)
    expect(padraoEscalaSchema.safeParse({ ...padrao, employee_ids: [] }).success).toBe(false)
    expect(padraoEscalaSchema.safeParse({ ...padrao, tipo_escala: 'ciclo' }).success).toBe(false)
    expect(padraoEscalaSchema.safeParse({ ...padrao, hora_almoco_inicio: '12:00' }).success).toBe(false)
    expect(padraoEscalaSchema.safeParse({ ...padrao, data_fim: '2026-11-01' }).success).toBe(true)
    expect(padraoEscalaSchema.safeParse({ ...padrao, data_fim: '2026-10-31' }).success).toBe(false)
  })
  it('mês e navegação', () => {
    const p = periodoDoMes('2028-02-10')
    expect([p.inicio, p.fim, p.rotulo]).toEqual(['2028-02-01', '2028-02-29', 'Fevereiro 2028'])
    expect([periodoDoMes('2026-12-15').proximo, periodoDoMes('2026-01-15').anterior]).toEqual(['2027-01-01', '2025-12-31'])
  })
})

describe('feriados', () => {
  const add = (data: string, nome: string, recorrente = false) => ({ id: data, data, nome, tipo: 'adicionado', recorrente }) as FeriadoEmpresa
  const rem = (data: string) => ({ id: 'r' + data, data, nome: 'x', tipo: 'removido', recorrente: false }) as FeriadoEmpresa

  it('nacionais e da empresa', () => {
    expect(feriadoDoDia('2026-11-02', [])?.nome).toBe('Finados')
    expect(feriadoDoDia('2026-11-03', [])).toBeNull()
    expect(feriadoDoDia('2026-08-10', [add('2026-08-10', 'Cidade')])?.nome).toBe('Cidade')
    expect(feriadoDoDia('2026-11-02', [add('2026-11-02', 'Recesso')])?.nome).toBe('Recesso')
  })
  it('recorrência e desconsiderar', () => {
    expect(feriadoDoDia('2027-08-10', [add('2026-08-10', 'Cidade')])).toBeNull()
    expect(feriadoDoDia('2027-08-10', [add('2026-08-10', 'Cidade', true)])?.nome).toBe('Cidade')
    expect(feriadoDoDia('2025-08-10', [add('2026-08-10', 'Cidade', true)])).toBeNull()
    expect(feriadoDoDia('2026-11-02', [rem('2026-11-02')])).toBeNull()
    expect(feriadoDoDia('2027-11-02', [rem('2026-11-02')])?.nome).toBe('Finados')
  })
  it('o mês marca o feriado da empresa', () => {
    const dias = generateMonth([], [], 8, 2026, 'e', [add('2026-08-10', 'Cidade')])
    expect([dias[9].date, dias[9].feriado, dias[9].feriado_nome]).toEqual(['2026-08-10', true, 'Cidade'])
    expect(generateMonth([], [], 8, 2026, 'e')[9].feriado).toBe(false)
  })
})
