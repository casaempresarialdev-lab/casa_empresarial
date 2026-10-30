import { z } from 'zod'

// Eventos do calendário (pessoais do usuário). Aviso opcional antes do horário.

// Antecedência do aviso, em minutos (0 = no horário)
export const ANTECEDENCIAS = [
  { value: 0,    label: 'No horário' },
  { value: 5,    label: '5 minutos antes' },
  { value: 15,   label: '15 minutos antes' },
  { value: 30,   label: '30 minutos antes' },
  { value: 60,   label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
] as const

const pad = (n: number) => String(n).padStart(2, '0')
const minutosDoCampo = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }

/**
 * Duração a partir do início e do término (HH:MM). Término menor ou igual ao início = dia seguinte.
 * Ex.: 09:00 → 10:30 = 90; 22:00 → 01:00 = 180.
 */
export const duracaoEntre = (inicio: string, fim: string) => {
  const d = minutosDoCampo(fim) - minutosDoCampo(inicio)
  return d > 0 ? d : d + 1440
}
/** Término (HH:MM) a partir do início (HH:MM) e da duração em minutos */
export const horaFimDe = (inicio: string, duracaoMin: number) => {
  const t = (minutosDoCampo(inicio) + duracaoMin) % 1440
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}
/** 90 → "1h30"; 45 → "45 min"; 120 → "2h" */
export const formatarDuracao = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h${pad(m)}` : `${h}h`
}

// ── Repetição (estilo Google Agenda) ─────────────────────────────────────────

export type Unidade = 'diaria' | 'semanal' | 'mensal' | 'anual'

/** Atalhos do campo "Repetir"; "personalizado" abre o painel "a cada N … / repetir em / termina" */
export type OpcaoRepeticao = 'nenhuma' | 'diaria' | 'semanal' | 'mensal' | 'anual' | 'dias_uteis' | 'personalizado'

export const UNIDADES: { value: Unidade; singular: string; plural: string }[] = [
  { value: 'diaria',  singular: 'dia',    plural: 'dias' },
  { value: 'semanal', singular: 'semana', plural: 'semanas' },
  { value: 'mensal',  singular: 'mês',    plural: 'meses' },
  { value: 'anual',   singular: 'ano',    plural: 'anos' },
]

export const DIAS_UTEIS = [1, 2, 3, 4, 5]
export const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const DIAS_SEMANA_NOME = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_SEMANA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export type Regra = {
  recorrencia: Unidade | null
  /** A cada N unidades (1 = toda) */
  intervalo: number
  dias_semana: number[] | null
  /** Último dia (YYYY-MM-DD); nulo = sem data final */
  recorrencia_ate: string | null
  /** Termina após N ocorrências; nulo = sem limite */
  ocorrencias: number | null
}

export const SEM_REPETICAO: Regra = { recorrencia: null, intervalo: 1, dias_semana: null, recorrencia_ate: null, ocorrencias: null }

/** Data do evento usada nos textos: dia da semana, dia do mês e mês */
export type DataBase = { diaSemana: number; diaMes: number; mes: number }

/** Textos dos atalhos para a data do evento ("Semanal: toda quinta", "Mensal: no dia 30"…) */
export function rotulosAtalhos(b: DataBase): { value: OpcaoRepeticao; label: string }[] {
  return [
    { value: 'nenhuma', label: 'Não se repete' },
    { value: 'diaria', label: 'Todos os dias' },
    { value: 'semanal', label: `Semanal: toda ${DIAS_SEMANA_LONGO[b.diaSemana]}` },
    { value: 'mensal', label: `Mensal: no dia ${b.diaMes}` },
    { value: 'anual', label: `Anual: em ${b.diaMes} de ${MESES_NOME[b.mes]}` },
    { value: 'dias_uteis', label: 'Todos os dias úteis (segunda a sexta)' },
    { value: 'personalizado', label: 'Personalizar…' },
  ]
}

/** Regra de um atalho (sempre sem data final) */
export function regraDoAtalho(opcao: Exclude<OpcaoRepeticao, 'personalizado'>, b: DataBase): Regra {
  if (opcao === 'nenhuma') return SEM_REPETICAO
  if (opcao === 'dias_uteis') return { ...SEM_REPETICAO, recorrencia: 'semanal', dias_semana: DIAS_UTEIS }
  if (opcao === 'semanal') return { ...SEM_REPETICAO, recorrencia: 'semanal', dias_semana: [b.diaSemana] }
  return { ...SEM_REPETICAO, recorrencia: opcao }
}

const ordenar = (d: number[] | null) => [...(d ?? [])].sort((a, b) => a - b)

export const mesmaRegra = (a: Regra, b: Regra) =>
  a.recorrencia === b.recorrencia &&
  (a.recorrencia ? a.intervalo : 1) === (b.recorrencia ? b.intervalo : 1) &&
  (a.recorrencia_ate ?? null) === (b.recorrencia_ate ?? null) &&
  (a.ocorrencias ?? null) === (b.ocorrencias ?? null) &&
  (a.recorrencia === 'semanal' ? ordenar(a.dias_semana).join() : '') === (b.recorrencia === 'semanal' ? ordenar(b.dias_semana).join() : '')

/** Qual atalho corresponde à regra (ou "personalizado") — para abrir o evento na edição */
export function atalhoDaRegra(r: Regra, b: DataBase): OpcaoRepeticao {
  if (!r.recorrencia) return 'nenhuma'
  for (const o of ['diaria', 'semanal', 'mensal', 'anual', 'dias_uteis'] as const) {
    if (mesmaRegra(r, regraDoAtalho(o, b))) return o
  }
  return 'personalizado'
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const listar = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l.at(-1)}` : l[0] ?? '')

/** "A cada 2 semanas: ter, qua, qui e sex · 13 vezes" */
export function descreverRepeticao(r: Pick<Regra, 'recorrencia' | 'dias_semana' | 'recorrencia_ate'> & { intervalo?: number | null; ocorrencias?: number | null }, b?: Partial<DataBase>) {
  if (!r.recorrencia) return null
  const n = r.intervalo && r.intervalo > 1 ? r.intervalo : 1
  const u = UNIDADES.find((x) => x.value === r.recorrencia)!
  let texto: string
  if (r.recorrencia === 'semanal') {
    const dias = ordenar(r.dias_semana)
    const quais = dias.join() === DIAS_UTEIS.join() ? 'dias úteis' : dias.length === 7 ? 'todos os dias' : listar(dias.map((d) => DIAS_SEMANA_NOME[d]))
    texto = `${n > 1 ? `A cada ${n} semanas` : 'Toda semana'}: ${quais}`
  } else {
    const base = n > 1 ? `A cada ${n} ${u.plural}` : r.recorrencia === 'diaria' ? 'Todos os dias' : r.recorrencia === 'mensal' ? 'Todo mês' : 'Todo ano'
    const detalhe = r.recorrencia === 'mensal' && b?.diaMes ? `, no dia ${b.diaMes}`
      : r.recorrencia === 'anual' && b?.diaMes && b.mes !== undefined ? `, em ${b.diaMes} de ${MESES_NOME[b.mes]}` : ''
    texto = base + detalhe
  }
  if (r.ocorrencias) return `${texto} · ${r.ocorrencias} ${r.ocorrencias === 1 ? 'vez' : 'vezes'}`
  return r.recorrencia_ate ? `${texto} · até ${dataCurta.format(new Date(r.recorrencia_ate))}` : `${texto} · sem data final`
}

const linkValido = (v: string) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false } }
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const eventoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  /** Data e hora em ISO (convertidas do fuso do usuário no navegador) */
  data_hora: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Informe a data e a hora'),
  duracao_min: z.number().int().min(1).max(1440),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0).max(10080),
  notificar_email: z.boolean(),
  /** Endereço (presencial) e/ou link (online); os dois = híbrido */
  local: z.string().trim().max(300).optional(),
  link_reuniao: z.string().trim().max(500).optional().refine((v) => !v || linkValido(v), 'Informe um link válido (https://…)'),
  recorrencia: z.enum(['nenhuma', 'diaria', 'semanal', 'mensal', 'anual']),
  /** A cada N unidades */
  intervalo: z.number().int().min(1).max(99).optional(),
  /** Semanal: dias da semana (0 = domingo … 6 = sábado) */
  dias_semana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  /** Último dia da repetição (YYYY-MM-DD); vazio = sem data final */
  recorrencia_ate: dataIso.optional(),
  /** Termina após N ocorrências */
  ocorrencias: z.number().int().min(1).max(999).optional(),
  /** E-mails dos convidados (usuários do sistema) */
  convidados: z.array(z.string().trim().toLowerCase().email()).max(50),
}).refine((d) => d.recorrencia !== 'semanal' || !!d.dias_semana?.length, { message: 'Escolha ao menos um dia da semana', path: ['dias_semana'] })

export type EventoData = z.infer<typeof eventoSchema>

// Formulário da tela: data, início e término em campos separados (juntados no fuso do usuário antes de enviar)
export const eventoFormSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o término'),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0),
  notificar_email: z.boolean(),
  local: z.string().max(300).optional(),
  link_reuniao: z.string().max(500).optional(),
  repeticao: z.enum(['nenhuma', 'diaria', 'semanal', 'mensal', 'anual', 'dias_uteis', 'personalizado']),
  // Personalizado: a cada N unidades, nos dias escolhidos (semana), termina nunca / em data / após N vezes
  // Números do painel: vazios viram NaN e desabilitados viram undefined — validados só quando valem (abaixo)
  intervalo: z.number().or(z.nan()).optional(),
  unidade: z.enum(['diaria', 'semanal', 'mensal', 'anual']),
  dias_semana: z.array(z.number().int().min(0).max(6)),
  termina: z.enum(['nunca', 'em', 'apos']),
  recorrencia_ate: z.string().optional(),
  ocorrencias: z.number().or(z.nan()).optional(),
}).superRefine((d, ctx) => {
  if (d.hora_fim === d.hora) ctx.addIssue({ code: 'custom', message: 'O término deve ser diferente do início', path: ['hora_fim'] })
  if (d.link_reuniao?.trim() && !linkValido(d.link_reuniao.trim())) {
    ctx.addIssue({ code: 'custom', message: 'Informe um link válido (https://…)', path: ['link_reuniao'] })
  }
  if (d.repeticao === 'personalizado') {
    const inteiroEntre = (v: number | undefined, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    if (!inteiroEntre(d.intervalo, 1, 99)) ctx.addIssue({ code: 'custom', message: 'Informe de 1 a 99', path: ['intervalo'] })
    if (d.termina === 'apos' && !inteiroEntre(d.ocorrencias, 1, 999)) ctx.addIssue({ code: 'custom', message: 'Informe de 1 a 999', path: ['ocorrencias'] })
    if (d.unidade === 'semanal' && !d.dias_semana.length) ctx.addIssue({ code: 'custom', message: 'Escolha ao menos um dia', path: ['dias_semana'] })
    if (d.termina === 'em') {
      if (!d.recorrencia_ate) ctx.addIssue({ code: 'custom', message: 'Informe a data', path: ['recorrencia_ate'] })
      else if (d.recorrencia_ate < d.data) ctx.addIssue({ code: 'custom', message: 'Deve ser depois do início', path: ['recorrencia_ate'] })
    }
  }
})

export type EventoFormData = z.infer<typeof eventoFormSchema>
