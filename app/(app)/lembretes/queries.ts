import { createAdminClient } from '@/lib/supabase/server'

export type Lembrete = {
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
export const LEMBRETE_COLS = '*'

// Lembretes pessoais do usuário, em ordem de data
export async function getLembretes(profileId: string): Promise<Lembrete[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reminders')
    .select(LEMBRETE_COLS)
    .eq('profile_id', profileId)
    .order('data_hora', { ascending: true })
  if (error) return [] // tabela ainda não criada no banco: lista vazia
  return (data ?? []) as Lembrete[]
}

/** Página de notificações: todos os avisos que já chegaram (pendentes e concluídos), mais recentes primeiro */
export async function getNotificacoes(profileId: string): Promise<Lembrete[]> {
  const admin = createAdminClient()
  const agora = Date.now()
  const { data, error } = await admin
    .from('reminders')
    .select(LEMBRETE_COLS)
    .eq('profile_id', profileId)
    .eq('notificar', true)
    .lte('data_hora', new Date(agora + 24 * 60 * 60 * 1000).toISOString())
    .order('data_hora', { ascending: false })
    .limit(200)
  if (error || !data) return []
  return (data as Lembrete[]).filter((l) => new Date(l.data_hora).getTime() - l.antecedencia_min * 60_000 <= agora)
}
