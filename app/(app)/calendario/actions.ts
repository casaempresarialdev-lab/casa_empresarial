'use server'

import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { eventoSchema, MAX_OCORRENCIAS, type EventoData } from '@/lib/validations/evento'
import { enviarAvisosEventos, enviarConviteEvento, enviarAgendaCompartilhada } from '@/lib/eventos-email'
import { findUserIdByEmail } from '@/lib/invitations'
import {
  EVENTO_COLS, horaAviso, normalizarEvento, getAvisosCalendario, getProximoAvisoConvite,
  type Evento, type Pessoa, type AvisoCalendario, type StatusConvite,
} from './queries'
import { getAvisosCompartilhamento, type AvisoCompartilhamento } from '../cofre-de-senhas/queries'

// Eventos do calendário: só o dono altera o evento (profile_id); convidados só respondem o próprio convite

export type ResumoNotificacoes = {
  /** Avisos de eventos que já chegaram (não concluídos) */
  avisos: Evento[]
  /** Credenciais do cofre compartilhadas com o usuário */
  compartilhamentos: AvisoCompartilhamento[]
  /** Convites recebidos, avisos de eventos para os quais fui convidado e agendas compartilhadas comigo */
  calendario: AvisoCalendario[]
  naoVistos: number
  proximoAvisoEm: string | null
}
const RESUMO_VAZIO: ResumoNotificacoes = { avisos: [], compartilhamentos: [], calendario: [], naoVistos: 0, proximoAvisoEm: null }

/** Editar/excluir um evento repetido: só ele ou ele e os próximos da série */
export type Escopo = 'este' | 'proximos'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FUSO = 'America/Sao_Paulo'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getAppUrl() {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

type Admin = ReturnType<typeof createAdminClient>

// Campos do evento (sem a recorrência, que só é definida ao criar)
function campos(d: EventoData) {
  return {
    titulo: d.titulo.trim(),
    descricao: d.descricao?.trim() || null,
    duracao_min: d.duracao_min,
    notificar: d.notificar,
    antecedencia_min: d.notificar ? d.antecedencia_min : 0,
    notificar_email: d.notificar && d.notificar_email,
    // Presencial, online ou os dois (híbrido)
    local: d.local?.trim() || null,
    link_reuniao: d.link_reuniao?.trim() || null,
  }
}

/** Dia (YYYY-MM-DD) no fuso do Brasil, para comparar com o "repetir até" */
const diaNoFuso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d)

/** Datas de todas as ocorrências da série, do início até o último dia escolhido (inclusive) */
function gerarOcorrencias(inicio: Date, recorrencia: EventoData['recorrencia'], ate?: string): Date[] {
  if (recorrencia === 'nenhuma' || !ate) return [inicio]
  const datas: Date[] = []
  for (let i = 0; datas.length < MAX_OCORRENCIAS; i++) {
    const d = new Date(inicio)
    if (recorrencia === 'diaria') d.setUTCDate(d.getUTCDate() + i)
    else if (recorrencia === 'semanal') d.setUTCDate(d.getUTCDate() + 7 * i)
    else {
      // Mensal: mesmo dia do mês; em meses mais curtos (ex.: dia 31), cai no último dia
      const dia = inicio.getUTCDate()
      d.setUTCDate(1)
      d.setUTCMonth(inicio.getUTCMonth() + i)
      const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
      d.setUTCDate(Math.min(dia, ultimo))
    }
    if (diaNoFuso(d) > ate) break
    datas.push(d)
  }
  return datas
}

/** E-mails dos convidados → usuários do sistema (erro se algum não existir ou for o próprio usuário) */
async function resolverConvidados(admin: Admin, emails: string[], meuEmail?: string): Promise<{ lista?: { id: string; email: string }[]; error?: string }> {
  const unicos = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
  const lista: { id: string; email: string }[] = []
  for (const email of unicos) {
    if (email === meuEmail?.toLowerCase()) continue // o dono já está no evento
    const id = await findUserIdByEmail(admin, email)
    if (!id) return { error: `Não encontramos um usuário da Casa Empresarial com o e-mail ${email}.` }
    lista.push({ id, email })
  }
  return { lista }
}

async function nomeDe(admin: Admin, profileId: string) {
  const { data } = await admin.from('profiles').select('name').eq('id', profileId).maybeSingle()
  return data?.name || 'Um usuário'
}

/** Manda o convite por e-mail e devolve quantos saíram (o evento já está salvo de qualquer forma) */
async function convidarPorEmail(admin: Admin, donoId: string, emails: string[], eventoId: string, evento: Parameters<typeof enviarConviteEvento>[0]['evento']) {
  if (!emails.length) return { enviados: 0, falhas: 0 }
  const resultados = await enviarConviteEvento({
    para: emails,
    donoNome: await nomeDe(admin, donoId),
    link: `${await getAppUrl()}/dashboard?evento=${eventoId}`,
    evento,
  })
  const enviados = resultados.filter((r) => r.status === 'enviado').length
  return { enviados, falhas: resultados.length - enviados }
}

export async function criarEventoAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const parsed = eventoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const admin = createAdminClient()
  const convidados = await resolverConvidados(admin, d.convidados, user.email)
  if (convidados.error) return { error: convidados.error }

  const datas = gerarOcorrencias(new Date(d.data_hora), d.recorrencia, d.recorrencia_ate)
  const repete = d.recorrencia !== 'nenhuma' && datas.length > 1
  const serieId = repete ? randomUUID() : null
  const base = {
    profile_id: user.id,
    ...campos(d),
    serie_id: serieId,
    recorrencia: repete ? (d.recorrencia as Exclude<EventoData['recorrencia'], 'nenhuma'>) : null,
    recorrencia_ate: repete ? d.recorrencia_ate ?? null : null,
  }

  const { data: criados, error } = await admin
    .from('reminders')
    .insert(datas.map((dt) => ({ ...base, data_hora: dt.toISOString() })))
    .select('id, data_hora')
  if (error) return { error: error.message }
  const ids = (criados ?? []).sort((a, b) => a.data_hora.localeCompare(b.data_hora)).map((c) => c.id)

  let convites = { enviados: 0, falhas: 0 }
  if (convidados.lista!.length && ids.length) {
    const { error: errP } = await admin.from('reminder_participants').insert(
      ids.flatMap((rid) => convidados.lista!.map((c) => ({ reminder_id: rid, profile_id: c.id, email: c.email }))),
    )
    if (errP) return { error: `Evento salvo, mas os convidados não foram adicionados: ${errP.message}` }
    convites = await convidarPorEmail(admin, user.id, convidados.lista!.map((c) => c.email), ids[0], {
      ...base, data_hora: datas[0].toISOString(),
    })
  }

  revalidatePath('/dashboard')
  return { success: true, ocorrencias: ids.length, convites }
}

/** Linhas afetadas por editar/excluir: o próprio evento ou ele e os próximos da mesma série */
async function eventosAlvo(admin: Admin, userId: string, id: string, escopo: Escopo) {
  const { data: atual } = await admin.from('reminders').select('id, data_hora, serie_id').eq('id', id).eq('profile_id', userId).maybeSingle()
  if (!atual) return null
  if (escopo === 'proximos' && atual.serie_id) {
    const { data } = await admin
      .from('reminders')
      .select('id, data_hora')
      .eq('serie_id', atual.serie_id)
      .eq('profile_id', userId)
      .gte('data_hora', atual.data_hora)
    return { atual, alvo: data ?? [] }
  }
  return { atual, alvo: [{ id: atual.id, data_hora: atual.data_hora }] }
}

export async function atualizarEventoAction(id: string, data: unknown, escopo: Escopo = 'este') {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const parsed = eventoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const admin = createAdminClient()
  const alvos = await eventosAlvo(admin, user.id, id, escopo)
  if (!alvos) return { error: 'Evento não encontrado.' }
  const convidados = await resolverConvidados(admin, d.convidados, user.email)
  if (convidados.error) return { error: convidados.error }

  // Nova data/hora deste evento; nos próximos da série, o mesmo deslocamento
  const delta = new Date(d.data_hora).getTime() - new Date(alvos.atual.data_hora).getTime()
  const ids = alvos.alvo.map((a) => a.id)
  // Mudou data/aviso: o e-mail e o aviso no sino voltam a valer no novo horário
  const comuns = { ...campos(d), email_enviado_em: null, aviso_visto_em: null }

  if (delta === 0) {
    const { error } = await admin.from('reminders').update(comuns).in('id', ids).eq('profile_id', user.id)
    if (error) return { error: error.message }
  } else {
    const resultados = await Promise.all(alvos.alvo.map((a) =>
      admin.from('reminders')
        .update({ ...comuns, data_hora: new Date(new Date(a.data_hora).getTime() + delta).toISOString() })
        .eq('id', a.id)
        .eq('profile_id', user.id),
    ))
    const falha = resultados.find((r) => r.error)
    if (falha?.error) return { error: falha.error.message }
  }

  // Convidados: remove quem saiu, adiciona quem entrou (em todas as ocorrências afetadas)
  const { data: existentes } = await admin.from('reminder_participants').select('reminder_id, profile_id').in('reminder_id', ids)
  const desejados = new Map(convidados.lista!.map((c) => [c.id, c.email]))
  const removidos = [...new Set((existentes ?? []).map((p) => p.profile_id).filter((pid) => !desejados.has(pid)))]
  if (removidos.length) await admin.from('reminder_participants').delete().in('reminder_id', ids).in('profile_id', removidos)
  const jaNoEvento = new Set((existentes ?? []).filter((p) => p.reminder_id === id).map((p) => p.profile_id))
  if (desejados.size) {
    await admin.from('reminder_participants').upsert(
      ids.flatMap((rid) => [...desejados].map(([pid, email]) => ({ reminder_id: rid, profile_id: pid, email }))),
      { onConflict: 'reminder_id,profile_id', ignoreDuplicates: true },
    )
  }
  // Horário mudou: os convidados voltam a receber o aviso no sino
  if (delta !== 0) await admin.from('reminder_participants').update({ lembrete_visto_em: null }).in('reminder_id', ids)

  // Só os convidados novos recebem o convite por e-mail
  const novos = convidados.lista!.filter((c) => !jaNoEvento.has(c.id)).map((c) => c.email)
  const { data: salvo } = await admin.from('reminders').select(EVENTO_COLS).eq('id', id).single()
  const convites = salvo ? await convidarPorEmail(admin, user.id, novos, id, normalizarEvento(salvo)) : { enviados: 0, falhas: 0 }

  revalidatePath('/dashboard')
  return { success: true, atualizados: ids.length, convites }
}

export async function concluirEventoAction(id: string, concluido: boolean) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { error } = await admin
    .from('reminders')
    .update({ concluido, concluido_em: concluido ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('profile_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function excluirEventoAction(id: string, escopo: Escopo = 'este') {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const alvos = await eventosAlvo(admin, user.id, id, escopo)
  if (!alvos) return { error: 'Evento não encontrado.' }
  const { error } = await admin.from('reminders').delete().in('id', alvos.alvo.map((a) => a.id)).eq('profile_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, excluidos: alvos.alvo.length }
}

/** Convidado aceita ou recusa: vale para este evento e, se for repetido, para os próximos da série */
export async function responderConviteAction(id: string, status: Exclude<StatusConvite, 'pendente'>) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { data: ev } = await admin.from('reminders').select('id, data_hora, serie_id').eq('id', id).maybeSingle()
  if (!ev) return { error: 'Evento não encontrado.' }

  let ids = [ev.id]
  if (ev.serie_id) {
    const { data } = await admin.from('reminders').select('id').eq('serie_id', ev.serie_id).gte('data_hora', ev.data_hora)
    ids = (data ?? []).map((r) => r.id)
  }
  const { data: atualizados, error } = await admin
    .from('reminder_participants')
    .update({ status, respondido_em: new Date().toISOString(), aviso_visto_em: new Date().toISOString() })
    .in('reminder_id', ids)
    .eq('profile_id', user.id)
    .select('id')
  if (error) return { error: error.message }
  if (!atualizados?.length) return { error: 'Você não foi convidado para este evento.' }
  revalidatePath('/dashboard')
  return { success: true }
}

/** Procura um usuário pelo e-mail (convidar para um evento ou compartilhar a agenda) */
export async function buscarPessoaAction(email: string): Promise<{ pessoa?: Pessoa; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const e = email.trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return { error: 'Informe um e-mail válido.' }
  if (e === user.email?.toLowerCase()) return { error: 'Este é o seu próprio e-mail.' }

  const admin = createAdminClient()
  const id = await findUserIdByEmail(admin, e)
  if (!id) return { error: 'Não encontramos um usuário da Casa Empresarial com este e-mail.' }
  const { data: p } = await admin.from('profiles').select('name, avatar_url').eq('id', id).maybeSingle()
  return { pessoa: { id, email: e, nome: p?.name || e, avatar_url: p?.avatar_url ?? null } }
}

/**
 * Sugestões para convidar: membros ativos das empresas das quais participo (nome, e-mail e foto).
 * Usuários de outras empresas não aparecem aqui; podem ser convidados digitando o e-mail completo.
 */
export async function listarContatosAction(): Promise<Pessoa[]> {
  const user = await getAuthUser()
  if (!user) return []
  const admin = createAdminClient()

  const { data: minhas } = await admin.from('company_members').select('company_id').eq('profile_id', user.id).eq('status', 'active')
  const empresas = (minhas ?? []).map((m) => m.company_id)
  if (!empresas.length) return []

  const { data: membros } = await admin
    .from('company_members')
    .select('profile_id')
    .in('company_id', empresas)
    .eq('status', 'active')
    .neq('profile_id', user.id)
    .limit(300)
  const ids = [...new Set((membros ?? []).map((m) => m.profile_id as string))]
  if (!ids.length) return []

  // O e-mail fica no cadastro de acesso (auth), não em profiles
  const [{ data: perfis }, contas] = await Promise.all([
    admin.from('profiles').select('id, name, avatar_url').in('id', ids),
    Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then((r) => [id, r.data.user?.email ?? null] as const))),
  ])
  const emailPorId = new Map(contas)
  return (perfis ?? [])
    .filter((p) => emailPorId.get(p.id))
    .map((p) => ({ id: p.id, nome: p.name || emailPorId.get(p.id)!, email: emailPorId.get(p.id)!.toLowerCase(), avatar_url: p.avatar_url ?? null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Compartilha a minha agenda: a pessoa passa a ver meus eventos (só visualização) */
export async function compartilharAgendaAction(email: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const busca = await buscarPessoaAction(email)
  if (!busca.pessoa) return { error: busca.error }

  const admin = createAdminClient()
  const { error } = await admin.from('calendar_shares').insert({ owner_id: user.id, shared_with: busca.pessoa.id, shared_with_email: busca.pessoa.email })
  if (error) return { error: error.code === '23505' ? 'Sua agenda já está compartilhada com esta pessoa.' : error.message }

  const envio = await enviarAgendaCompartilhada({ para: busca.pessoa.email, donoNome: await nomeDe(admin, user.id), link: `${await getAppUrl()}/dashboard` })
  revalidatePath('/dashboard')
  return { success: true, pessoa: busca.pessoa, emailEnviado: envio.status === 'enviado' }
}

/** Dono para de compartilhar a agenda com alguém */
export async function removerAgendaCompartilhadaAction(profileId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { error } = await admin.from('calendar_shares').delete().eq('owner_id', user.id).eq('shared_with', profileId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

/** Quem recebeu deixa de acompanhar a agenda de alguém */
export async function deixarDeAcompanharAction(ownerId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { error } = await admin.from('calendar_shares').delete().eq('owner_id', ownerId).eq('shared_with', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Para o sino da barra: avisos de eventos que já chegaram (notificação ligada e hora do aviso alcançada),
 * convites, agendas e senhas compartilhadas, contador de não vistos e quando será o próximo aviso (para avisar no minuto exato).
 * Também envia, com o sistema aberto, os e-mails de aviso devidos deste usuário.
 */
export async function resumoNotificacoesAction(): Promise<ResumoNotificacoes> {
  const user = await getAuthUser()
  if (!user) return RESUMO_VAZIO
  const admin = createAdminClient()

  // E-mails de aviso deste usuário (a rotina agendada cobre quem está com o sistema fechado)
  if (user.email) await enviarAvisosEventos(admin, { profileId: user.id, email: user.email })

  const [{ data, error }, compartilhamentos, calendario, proximoConvite] = await Promise.all([
    admin
      .from('reminders')
      .select(EVENTO_COLS)
      .eq('profile_id', user.id)
      .eq('concluido', false)
      .eq('notificar', true)
      .order('data_hora', { ascending: true })
      .limit(100),
    getAvisosCompartilhamento(user.id, 20),
    getAvisosCalendario(user.id, 30),
    getProximoAvisoConvite(user.id),
  ])
  const outrosNaoVistos = compartilhamentos.filter((c) => !c.aviso_visto_em).length + calendario.filter((c) => !c.visto).length
  if (error || !data) return { ...RESUMO_VAZIO, compartilhamentos, calendario, naoVistos: outrosNaoVistos }

  const agora = Date.now()
  const lista = (data as Parameters<typeof normalizarEvento>[0][]).map((r) => ({ ...normalizarEvento(r), origem: 'meu' as const, participantes: [] }))
  const avisos = lista.filter((e) => horaAviso(e) <= agora)
  const futuros = [...lista.filter((e) => horaAviso(e) > agora).map(horaAviso), ...(proximoConvite ? [proximoConvite] : [])]
  const proximoAvisoEm = futuros.length ? new Date(Math.min(...futuros)).toISOString() : null
  // Contador do sino: só os avisos ainda não vistos
  const naoVistos = avisos.filter((e) => !e.aviso_visto_em).length + outrosNaoVistos
  return { avisos, compartilhamentos, calendario, naoVistos, proximoAvisoEm }
}

/** Abriu o sino ou a página de notificações: os avisos que já chegaram passam a "vistos" (zera o contador) */
export async function marcarAvisosVistosAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const agoraIso = new Date().toISOString()
  // Compartilhamentos, convites e agendas recebidos (ignora erro se as colunas ainda não existirem no banco)
  await Promise.all([
    admin.from('credential_shares').update({ aviso_visto_em: agoraIso }).eq('shared_with', user.id).is('aviso_visto_em', null),
    admin.from('reminder_participants').update({ aviso_visto_em: agoraIso }).eq('profile_id', user.id).is('aviso_visto_em', null),
    admin.from('calendar_shares').update({ aviso_visto_em: agoraIso }).eq('shared_with', user.id).is('aviso_visto_em', null),
  ])

  // Avisos de horário dos eventos para os quais fui convidado
  const { data: convites } = await admin
    .from('reminder_participants')
    .select('id, reminders(data_hora, antecedencia_min, notificar)')
    .eq('profile_id', user.id)
    .is('lembrete_visto_em', null)
    .limit(500)
  type Conv = { id: string; reminders: { data_hora: string; antecedencia_min: number; notificar: boolean } | null }
  const convitesChegados = ((convites ?? []) as unknown as Conv[]).filter((c) => c.reminders?.notificar && horaAviso(c.reminders) <= Date.now()).map((c) => c.id)
  if (convitesChegados.length) await admin.from('reminder_participants').update({ lembrete_visto_em: agoraIso }).in('id', convitesChegados)

  const { data } = await admin
    .from('reminders')
    .select('id, data_hora, antecedencia_min')
    .eq('profile_id', user.id)
    .eq('notificar', true)
    .is('aviso_visto_em', null)
    .lte('data_hora', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
  const ids = (data ?? []).filter((e) => horaAviso(e) <= Date.now()).map((e) => e.id)
  if (!ids.length) return { success: true }
  const { error } = await admin.from('reminders').update({ aviso_visto_em: agoraIso }).in('id', ids)
  if (error) return { error: error.message }
  return { success: true }
}
