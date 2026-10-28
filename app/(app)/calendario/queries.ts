import { createAdminClient } from '@/lib/supabase/server'

// Eventos do calendário: pessoais do usuário (tabela "reminders", criada quando eram lembretes)

export type Evento = {
  id: string
  titulo: string
  descricao: string | null
  data_hora: string
  notificar: boolean
  antecedencia_min: number
  notificar_email: boolean
  email_enviado_em: string | null
  concluido: boolean
  concluido_em: string | null
  /** Quando o aviso foi visto (sino aberto ou página de notificações) */
  aviso_visto_em?: string | null
}

// '*': tolera colunas novas ainda não criadas no banco (ex.: aviso_visto_em)
export const EVENTO_COLS = '*'

/** Hora em que o aviso do evento deve chegar (data/hora menos a antecedência) */
export const horaAviso = (e: Pick<Evento, 'data_hora' | 'antecedencia_min'>) =>
  new Date(e.data_hora).getTime() - e.antecedencia_min * 60_000

// Eventos do usuário, em ordem de data (para o calendário da página inicial)
export async function getEventos(profileId: string): Promise<Evento[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reminders')
    .select(EVENTO_COLS)
    .eq('profile_id', profileId)
    .order('data_hora', { ascending: true })
    .limit(1000)
  if (error) return [] // tabela ainda não criada no banco: calendário vazio
  return (data ?? []) as Evento[]
}

/** Página de notificações: avisos de eventos que já chegaram (pendentes e concluídos), mais recentes primeiro */
export async function getNotificacoes(profileId: string): Promise<Evento[]> {
  const admin = createAdminClient()
  const agora = Date.now()
  const { data, error } = await admin
    .from('reminders')
    .select(EVENTO_COLS)
    .eq('profile_id', profileId)
    .eq('notificar', true)
    .lte('data_hora', new Date(agora + 24 * 60 * 60 * 1000).toISOString())
    .order('data_hora', { ascending: false })
    .limit(200)
  if (error || !data) return []
  return (data as Evento[]).filter((e) => horaAviso(e) <= agora)
}
