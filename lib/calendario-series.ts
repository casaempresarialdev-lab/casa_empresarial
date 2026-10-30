import { createAdminClient } from '@/lib/supabase/server'
import type { Regra } from '@/lib/validations/evento'

// Séries de eventos repetidos — só no servidor.
// Cada ocorrência é uma linha em reminders; reminder_series guarda a regra e até onde já foi gerada.
// As ocorrências ficam criadas até HORIZONTE_MESES à frente; ao abrir o calendário e na rotina diária,
// estenderSeries cria as próximas. Assim a repetição não precisa de data final.

type Admin = ReturnType<typeof createAdminClient>

const FUSO = 'America/Sao_Paulo'
export const HORIZONTE_MESES = 12
/** Máximo de ocorrências criadas de uma vez (ex.: diária por 1 ano) */
const MAX_POR_VEZ = 400

/** Dia (YYYY-MM-DD) no fuso do Brasil */
export const diaNoFuso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d)
const DIA_DA_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const semanaFormat = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' })
/** Dia da semana no fuso do Brasil (0 = domingo) */
export const diaDaSemana = (d: Date) => DIA_DA_SEMANA[semanaFormat.format(d)]

/** Dia anterior (YYYY-MM-DD) */
export const diaAnterior = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Até quando as ocorrências ficam criadas: hoje + HORIZONTE_MESES */
export const horizonte = () => {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + HORIZONTE_MESES)
  return d
}

/** Dias corridos desde 1970 da data no fuso do Brasil (para contar semanas) */
const numeroDoDia = (d: Date) => Date.parse(`${diaNoFuso(d)}T00:00:00Z`) / 86_400_000

/** Soma meses mantendo o dia (em meses mais curtos, ex.: dia 31 ou 29/02, cai no último dia) */
function somarMeses(inicio: Date, meses: number) {
  const d = new Date(inicio)
  const dia = inicio.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(inicio.getUTCMonth() + meses)
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dia, ultimo))
  return d
}

/**
 * Datas das ocorrências da regra a partir de `inicio` (a primeira ocorrência, que sempre entra),
 * depois de `depoisDe` (exclusivo) e até `ate` (e até a data final da regra, se houver).
 * Respeita "a cada N" (intervalo); `max` limita quantas devolve (ex.: o que falta para "após N ocorrências").
 */
export function datasDaRegra(inicio: Date, regra: Regra, opcoes: { depoisDe?: Date | null; ate: Date; max?: number }): Date[] {
  if (!regra.recorrencia) return []
  const max = opcoes.max ?? MAX_POR_VEZ
  const depoisDe = opcoes.depoisDe?.getTime() ?? -Infinity
  const n = Math.max(1, regra.intervalo || 1)
  const datas: Date[] = []
  const dias = new Set(regra.recorrencia === 'semanal' && regra.dias_semana?.length ? regra.dias_semana : [diaDaSemana(inicio)])
  // Semanal "a cada N semanas": semanas contadas a partir do domingo da semana do início
  const domingoInicio = numeroDoDia(inicio) - diaDaSemana(inicio)

  for (let i = 0; i < 20_000 && datas.length < max; i++) {
    let d: Date
    if (regra.recorrencia === 'mensal') d = somarMeses(inicio, i * n)
    else if (regra.recorrencia === 'anual') d = somarMeses(inicio, i * n * 12)
    else if (regra.recorrencia === 'diaria') { d = new Date(inicio); d.setUTCDate(d.getUTCDate() + i * n) }
    else {
      d = new Date(inicio)
      d.setUTCDate(d.getUTCDate() + i)
      // Semanal: só os dias escolhidos e só nas semanas da vez (a primeira ocorrência sempre entra)
      const semana = Math.floor((numeroDoDia(d) - domingoInicio) / 7)
      if (i > 0 && (semana % n !== 0 || !dias.has(diaDaSemana(d)))) continue
    }
    if (d > opcoes.ate) break
    if (regra.recorrencia_ate && diaNoFuso(d) > regra.recorrencia_ate) break
    if (d.getTime() > depoisDe) datas.push(d)
  }
  return datas
}

// Colunas copiadas da última ocorrência para as novas (o resto é próprio de cada ocorrência)
const CAMPOS_COPIADOS = [
  'profile_id', 'titulo', 'descricao', 'duracao_min', 'notificar', 'antecedencia_min', 'notificar_email',
  'local', 'link_reuniao', 'serie_id', 'recorrencia', 'intervalo', 'dias_semana', 'recorrencia_ate', 'ocorrencias',
] as const

/** Cria as ocorrências de `datas` copiando os campos de `modelo` e os convidados dele */
export async function criarOcorrencias(admin: Admin, modelo: Record<string, unknown>, datas: Date[], convidados: { profile_id: string; email: string; status?: string }[]) {
  if (!datas.length) return { ids: [] as string[] }
  const base = Object.fromEntries(CAMPOS_COPIADOS.map((c) => [c, modelo[c] ?? null]))
  const { data, error } = await admin.from('reminders').insert(datas.map((d) => ({ ...base, data_hora: d.toISOString() }))).select('id')
  if (error) return { error: error.message, ids: [] as string[] }
  const ids = (data ?? []).map((r) => r.id as string)
  if (convidados.length && ids.length) {
    // Convite já avisado na criação da série: as novas ocorrências não geram outra notificação
    const agora = new Date().toISOString()
    await admin.from('reminder_participants').insert(ids.flatMap((rid) => convidados.map((c) => ({
      reminder_id: rid, profile_id: c.profile_id, email: c.email, status: c.status ?? 'pendente', aviso_visto_em: agora,
    }))))
  }
  return { ids }
}

/** Cria as próximas ocorrências das séries que estão perto do fim do horizonte (de um usuário ou de todos) */
export async function estenderSeries(admin: Admin, profileId?: string) {
  const limite = horizonte()
  const gatilho = new Date(limite)
  gatilho.setUTCMonth(gatilho.getUTCMonth() - 1) // estende quando falta menos de 1 mês para o horizonte
  let q = admin.from('reminder_series').select('*').lt('gerado_ate', gatilho.toISOString()).limit(50)
  if (profileId) q = q.eq('profile_id', profileId)
  const { data: series, error } = await q
  if (error || !series?.length) return { estendidas: 0 }

  let estendidas = 0
  for (const s of series) {
    // Modelo: a última ocorrência (traz as edições mais recentes da série)
    const { data: ultima } = await admin.from('reminders').select('*').eq('serie_id', s.id).order('data_hora', { ascending: false }).limit(1).maybeSingle()
    if (!ultima) { await admin.from('reminder_series').delete().eq('id', s.id); continue }

    // "Após N ocorrências": cria só o que falta
    const restantes = s.ocorrencias ? s.ocorrencias - (s.geradas ?? 0) : undefined
    const regra: Regra = { recorrencia: s.recorrencia, intervalo: s.intervalo ?? 1, dias_semana: s.dias_semana, recorrencia_ate: s.ate, ocorrencias: s.ocorrencias ?? null }
    const datas = restantes !== undefined && restantes <= 0 ? [] : datasDaRegra(new Date(s.inicio), regra, { depoisDe: new Date(s.gerado_ate), ate: limite, max: restantes })
    if (datas.length) {
      const { data: conv } = await admin.from('reminder_participants').select('profile_id, email, status').eq('reminder_id', ultima.id)
      const r = await criarOcorrencias(admin, ultima, datas, conv ?? [])
      if (r.error) { console.error('[series] não foi possível estender', s.id, r.error); continue }
      estendidas++
    }
    // Daqui para trás já está tudo criado (mesmo sem novas datas, ex.: série com data final)
    await admin.from('reminder_series').update({ gerado_ate: limite.toISOString(), geradas: (s.geradas ?? 0) + datas.length }).eq('id', s.id)
  }
  return { estendidas }
}
