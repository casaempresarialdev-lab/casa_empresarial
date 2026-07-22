// Feriados nacionais brasileiros — fixos + móveis (cálculo via Páscoa)

function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type FeriadoInfo = { nome: string }

export function buildFeriadoMap(year: number): Map<string, FeriadoInfo> {
  const map = new Map<string, FeriadoInfo>()

  // Fixos
  const fixos: [string, string][] = [
    [`${year}-01-01`, 'Confraternização Universal'],
    [`${year}-04-21`, 'Tiradentes'],
    [`${year}-05-01`, 'Dia do Trabalho'],
    [`${year}-09-07`, 'Independência do Brasil'],
    [`${year}-10-12`, 'Nossa Senhora Aparecida'],
    [`${year}-11-02`, 'Finados'],
    [`${year}-11-15`, 'Proclamação da República'],
    [`${year}-11-20`, 'Consciência Negra'],
    [`${year}-12-25`, 'Natal'],
  ]
  for (const [key, nome] of fixos) map.set(key, { nome })

  // Móveis baseados na Páscoa
  const pascoa = easterDate(year)
  map.set(toKey(addDays(pascoa, -48)), { nome: 'Carnaval' })          // segunda de carnaval
  map.set(toKey(addDays(pascoa, -47)), { nome: 'Carnaval' })          // terça de carnaval
  map.set(toKey(addDays(pascoa, -2)),  { nome: 'Sexta-feira Santa' })
  map.set(toKey(pascoa),               { nome: 'Páscoa' })
  map.set(toKey(addDays(pascoa, 60)),  { nome: 'Corpus Christi' })

  return map
}

// Cache por ano para não recalcular a cada célula
const cache = new Map<number, Map<string, FeriadoInfo>>()

export function getFeriado(dateStr: string): FeriadoInfo | null {
  const year = parseInt(dateStr.slice(0, 4))
  if (!cache.has(year)) cache.set(year, buildFeriadoMap(year))
  return cache.get(year)!.get(dateStr) ?? null
}
