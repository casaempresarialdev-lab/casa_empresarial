'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { eventoSchema } from '@/lib/validations/evento'
import { enviarAvisosEventos } from '@/lib/eventos-email'
import { EVENTO_COLS, horaAviso, type Evento } from './queries'
import { getAvisosCompartilhamento, type AvisoCompartilhamento } from '../cofre-de-senhas/queries'

// Eventos do calendário (pessoais): toda operação fica restrita aos eventos do próprio usuário (profile_id)

export type ResumoNotificacoes = {
  /** Avisos de eventos que já chegaram (não concluídos) */
  avisos: Evento[]
  /** Credenciais do cofre compartilhadas com o usuário */
  compartilhamentos: AvisoCompartilhamento[]
  naoVistos: number
  proximoAvisoEm: string | null
}
const RESUMO_VAZIO: ResumoNotificacoes = { avisos: [], compartilhamentos: [], naoVistos: 0, proximoAvisoEm: null }

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function campos(d: ReturnType<typeof eventoSchema.parse>) {
  return {
    titulo: d.titulo.trim(),
    descricao: d.descricao?.trim() || null,
    data_hora: new Date(d.data_hora).toISOString(),
    notificar: d.notificar,
    antecedencia_min: d.notificar ? d.antecedencia_min : 0,
    notificar_email: d.notificar && d.notificar_email,
  }
}

export async function criarEventoAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const parsed = eventoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { error } = await admin.from('reminders').insert({ profile_id: user.id, ...campos(parsed.data) })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function atualizarEventoAction(id: string, data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const parsed = eventoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  // Mudou data/aviso: o e-mail e o aviso no sino voltam a valer no novo horário
  const { error } = await admin
    .from('reminders')
    .update({ ...campos(parsed.data), email_enviado_em: null, aviso_visto_em: null })
    .eq('id', id)
    .eq('profile_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
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

export async function excluirEventoAction(id: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { error } = await admin.from('reminders').delete().eq('id', id).eq('profile_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Para o sino da barra: avisos de eventos que já chegaram (notificação ligada e hora do aviso alcançada),
 * senhas compartilhadas, contador de não vistos e quando será o próximo aviso (para avisar no minuto exato).
 * Também envia, com o sistema aberto, os e-mails de aviso devidos deste usuário.
 */
export async function resumoNotificacoesAction(): Promise<ResumoNotificacoes> {
  const user = await getAuthUser()
  if (!user) return RESUMO_VAZIO
  const admin = createAdminClient()

  // E-mails de aviso deste usuário (a rotina agendada cobre quem está com o sistema fechado)
  if (user.email) await enviarAvisosEventos(admin, { profileId: user.id, email: user.email })

  const [{ data, error }, compartilhamentos] = await Promise.all([
    admin
      .from('reminders')
      .select(EVENTO_COLS)
      .eq('profile_id', user.id)
      .eq('concluido', false)
      .eq('notificar', true)
      .order('data_hora', { ascending: true })
      .limit(100),
    getAvisosCompartilhamento(user.id, 20),
  ])
  const compNaoVistos = compartilhamentos.filter((c) => !c.aviso_visto_em).length
  if (error || !data) return { ...RESUMO_VAZIO, compartilhamentos, naoVistos: compNaoVistos }

  const agora = Date.now()
  const lista = data as Evento[]
  const avisos = lista.filter((e) => horaAviso(e) <= agora)
  const futuros = lista.filter((e) => horaAviso(e) > agora).map(horaAviso)
  const proximoAvisoEm = futuros.length ? new Date(Math.min(...futuros)).toISOString() : null
  // Contador do sino: só os avisos ainda não vistos
  const naoVistos = avisos.filter((e) => !e.aviso_visto_em).length + compNaoVistos
  return { avisos, compartilhamentos, naoVistos, proximoAvisoEm }
}

/** Abriu o sino ou a página de notificações: os avisos que já chegaram passam a "vistos" (zera o contador) */
export async function marcarAvisosVistosAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  // Compartilhamentos recebidos (ignora erro se a coluna ainda não existir no banco)
  await admin.from('credential_shares').update({ aviso_visto_em: new Date().toISOString() }).eq('shared_with', user.id).is('aviso_visto_em', null)
  const { data } = await admin
    .from('reminders')
    .select('id, data_hora, antecedencia_min')
    .eq('profile_id', user.id)
    .eq('notificar', true)
    .is('aviso_visto_em', null)
    .lte('data_hora', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
  const ids = (data ?? []).filter((e) => horaAviso(e) <= Date.now()).map((e) => e.id)
  if (!ids.length) return { success: true }
  const { error } = await admin.from('reminders').update({ aviso_visto_em: new Date().toISOString() }).in('id', ids)
  if (error) return { error: error.message }
  return { success: true }
}
