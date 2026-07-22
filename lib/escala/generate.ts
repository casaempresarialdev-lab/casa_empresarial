import { getFeriado } from './feriados'

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type FolgaPattern =
  | { tipo: 'quinzenal';         dia: number; data_ref: string }
  | { tipo: 'intervalo_dias';    intervalo: number; data_ref: string }
  | { tipo: 'intervalo_semanas'; intervalo: number; dia: number; data_ref: string }
  | { tipo: 'intervalo_meses';   intervalo: number; data_ref: string }

export type ScheduleRule = {
  id: string
  employee_id: string
  data_inicio: string           // YYYY-MM-DD
  data_fim: string | null
  hora_entrada: string          // HH:MM
  hora_saida: string            // HH:MM
  hora_almoco_inicio: string | null
  hora_almoco_fim: string | null
  tipo_escala: 'semanal' | '12x36'
  dias_folga: number[]          // dias da semana de folga (0=Dom..6=Sáb)
  data_referencia: string | null // para 12x36
  folga_patterns: FolgaPattern[]
}

export type ScheduleException = {
  id: string
  employee_id: string
  data: string        // YYYY-MM-DD
  tipo: 'folga' | 'trabalho'
  observacao: string | null
}

export type DayTipo = 'trabalho' | 'folga' | 'sem_regra'

export type DayResult = {
  date: string              // YYYY-MM-DD
  tipo: DayTipo
  hora_entrada: string | null
  hora_saida: string | null
  hora_almoco_inicio: string | null
  hora_almoco_fim: string | null
  feriado: boolean
  feriado_nome: string | null
  domingo: boolean
  excecao: boolean          // true se o tipo foi forçado por exceção manual
  rule_id: string | null
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function dateFromStr(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Retorna a regra vigente para uma data (a mais recente com data_inicio <= date)
function getActiveRule(rules: ScheduleRule[], dateStr: string): ScheduleRule | null {
  const date = dateFromStr(dateStr)
  let best: ScheduleRule | null = null

  for (const r of rules) {
    if (dateFromStr(r.data_inicio) > date) continue
    if (r.data_fim && dateFromStr(r.data_fim) < date) continue
    if (!best || dateFromStr(r.data_inicio) > dateFromStr(best.data_inicio)) {
      best = r
    }
  }
  return best
}

// 12x36: trabalha no dia 0 do ciclo (data_referencia), folga nos dias 1 e 2, repete
function is12x36WorkDay(rule: ScheduleRule, dateStr: string): boolean {
  if (!rule.data_referencia) return false
  const ref  = dateFromStr(rule.data_referencia)
  const date = dateFromStr(dateStr)
  const diff = diffDays(ref, date)
  if (diff < 0) return false
  return diff % 3 === 0
}

// Verifica se o dia cai em algum folga_pattern
function matchesFolgaPattern(pattern: FolgaPattern, dateStr: string): boolean {
  const date    = dateFromStr(dateStr)
  const dayOfWk = date.getDay()

  switch (pattern.tipo) {
    case 'quinzenal': {
      if (dayOfWk !== pattern.dia) return false
      const ref  = dateFromStr(pattern.data_ref)
      const diff = diffDays(ref, date)
      return diff >= 0 && diff % 14 === 0
    }
    case 'intervalo_dias': {
      const ref  = dateFromStr(pattern.data_ref)
      const diff = diffDays(ref, date)
      return diff >= 0 && diff % pattern.intervalo === 0
    }
    case 'intervalo_semanas': {
      if (dayOfWk !== pattern.dia) return false
      const ref  = dateFromStr(pattern.data_ref)
      const diff = diffDays(ref, date)
      return diff >= 0 && diff % (pattern.intervalo * 7) === 0
    }
    case 'intervalo_meses': {
      const ref = dateFromStr(pattern.data_ref)
      if (date < ref) return false
      const monthsDiff =
        (date.getFullYear() - ref.getFullYear()) * 12 +
        (date.getMonth() - ref.getMonth())
      return monthsDiff % pattern.intervalo === 0 && date.getDate() === ref.getDate()
    }
  }
}

// Calcula o tipo do dia a partir da regra (sem considerar exceções)
function calcTipo(rule: ScheduleRule, dateStr: string): DayTipo {
  if (rule.tipo_escala === '12x36') {
    return is12x36WorkDay(rule, dateStr) ? 'trabalho' : 'folga'
  }

  // Semanal: é folga se o dia da semana está em dias_folga
  const dayOfWk = dateFromStr(dateStr).getDay()
  if (rule.dias_folga.includes(dayOfWk)) return 'folga'

  // Ou se cai num folga_pattern extra
  for (const p of rule.folga_patterns) {
    if (matchesFolgaPattern(p, dateStr)) return 'folga'
  }

  return 'trabalho'
}

// ── Função principal ──────────────────────────────────────────────────────────

export function generateMonth(
  rules: ScheduleRule[],
  exceptions: ScheduleException[],
  mes: number,
  ano: number,
  employeeId: string,
): DayResult[] {
  const empRules = rules.filter(r => r.employee_id === employeeId)
  const excMap   = new Map<string, ScheduleException>(
    exceptions
      .filter(e => e.employee_id === employeeId)
      .map(e => [e.data, e]),
  )

  const totalDias = new Date(ano, mes, 0).getDate()
  const results: DayResult[] = []

  for (let d = 1; d <= totalDias; d++) {
    const dateStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ferInfo = getFeriado(dateStr)
    const date    = dateFromStr(dateStr)
    const domingo = date.getDay() === 0

    const rule    = getActiveRule(empRules, dateStr)
    const exc     = excMap.get(dateStr)

    let tipo: DayTipo
    let excecao = false

    if (exc) {
      tipo    = exc.tipo === 'folga' ? 'folga' : 'trabalho'
      excecao = true
    } else if (rule) {
      tipo = calcTipo(rule, dateStr)
    } else {
      tipo = 'sem_regra'
    }

    results.push({
      date:               dateStr,
      tipo,
      hora_entrada:       rule && tipo === 'trabalho' && !exc ? rule.hora_entrada : null,
      hora_saida:         rule && tipo === 'trabalho' && !exc ? rule.hora_saida   : null,
      hora_almoco_inicio: rule && tipo === 'trabalho' && !exc ? rule.hora_almoco_inicio : null,
      hora_almoco_fim:    rule && tipo === 'trabalho' && !exc ? rule.hora_almoco_fim    : null,
      feriado:            !!ferInfo,
      feriado_nome:       ferInfo?.nome ?? null,
      domingo,
      excecao,
      rule_id:            rule?.id ?? null,
    })
  }

  return results
}

// Gera todos os funcionários de uma vez para o calendário
export function generateMonthAll(
  rules: ScheduleRule[],
  exceptions: ScheduleException[],
  mes: number,
  ano: number,
  employees: { id: string; nome: string }[],
): Record<string, DayResult[]> {
  const result: Record<string, DayResult[]> = {}
  for (const emp of employees) {
    result[emp.id] = generateMonth(rules, exceptions, mes, ano, emp.id)
  }
  return result
}
