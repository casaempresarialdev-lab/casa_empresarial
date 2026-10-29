import { createAdminClient } from '@/lib/supabase/server'

// Eventos do calendário: pessoais do usuário (tabela "reminders", criada quando eram lembretes),
// os convites recebidos e os eventos das agendas compartilhadas com ele

export type StatusConvite = 'pendente' | 'aceito' | 'recusado'

export type Pessoa = { id: string; nome: string; email: string; avatar_url: string | null }
export type Participante = Pessoa & { status: StatusConvite }

export type Evento = {
  id: string
  /** Dono do evento */
  profile_id: string
  titulo: string
  descricao: string | null
  data_hora: string
  duracao_min: number
  notificar: boolean
  antecedencia_min: number
  notificar_email: boolean
  email_enviado_em: string | null
  concluido: boolean
  concluido_em: string | null
  /** Quando o aviso foi visto (sino aberto ou página de notificações) */
  aviso_visto_em?: string | null
  /** Endereço (presencial) e/ou link da reunião (online); os dois = híbrido */
  local: string | null
  link_reuniao: string | null
  serie_id: string | null
  recorrencia: 'diaria' | 'semanal' | 'mensal' | null
  recorrencia_ate: string | null
  /** De onde o evento vem para este usuário: dele, convite recebido ou agenda que ele acompanha */
  origem: 'meu' | 'convite' | 'agenda'
  dono?: Pessoa
  participantes: Participante[]
  /** Resposta deste usuário (só em convites) */
  meu_status?: StatusConvite
}

// '*': tolera colunas novas ainda não criadas no banco (ex.: aviso_visto_em)
export const EVENTO_COLS = '*'

type Linha = Omit<Evento, 'origem' | 'dono' | 'participantes' | 'meu_status'>

/** Completa a linha do banco com os padrões das colunas que podem ainda não existir */
export function normalizarEvento(r: Partial<Linha> & { id: string; profile_id: string; titulo: string; data_hora: string }): Linha {
  return {
    descricao: null, duracao_min: 60, notificar: false, antecedencia_min: 0, notificar_email: false, email_enviado_em: null,
    concluido: false, concluido_em: null, local: null, link_reuniao: null, serie_id: null, recorrencia: null, recorrencia_ate: null,
    ...r,
  } as Linha
}

/** Hora em que o aviso do evento deve chegar (data/hora menos a antecedência) */
export const horaAviso = (e: Pick<Evento, 'data_hora' | 'antecedencia_min'>) =>
  new Date(e.data_hora).getTime() - e.antecedencia_min * 60_000

type Admin = ReturnType<typeof createAdminClient>

/** Nome e foto de vários usuários de uma vez (o e-mail não fica em profiles: vem do convite/compartilhamento) */
export async function getPessoas(admin: Admin, ids: string[]): Promise<Map<string, Pessoa>> {
  const unicos = [...new Set(ids)]
  if (!unicos.length) return new Map()
  const { data } = await admin.from('profiles').select('id, name, avatar_url').in('id', unicos)
  return new Map((data ?? []).map((p) => [p.id, { id: p.id, nome: p.name || 'Usuário', email: '', avatar_url: p.avatar_url ?? null }]))
}

/** Convidados de vários eventos (com nome e foto) */
async function getParticipantes(admin: Admin, reminderIds: string[]): Promise<Map<string, Participante[]>> {
  const m = new Map<string, Participante[]>()
  if (!reminderIds.length) return m
  const { data, error } = await admin.from('reminder_participants').select('reminder_id, profile_id, email, status').in('reminder_id', reminderIds)
  if (error || !data) return m
  const pessoas = await getPessoas(admin, data.map((p) => p.profile_id))
  for (const p of data) {
    const pessoa = pessoas.get(p.profile_id) ?? { id: p.profile_id, nome: p.email, email: p.email, avatar_url: null }
    m.set(p.reminder_id, [...(m.get(p.reminder_id) ?? []), { ...pessoa, email: p.email, status: p.status as StatusConvite }])
  }
  return m
}

// Calendário da página inicial: eventos do usuário + convites recebidos + agendas que ele acompanha
export async function getEventos(profileId: string): Promise<Evento[]> {
  const admin = createAdminClient()
  // Agendas de outras pessoas: só a partir de 3 meses atrás (o histórico antigo não interessa)
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString()

  const [{ data: meus, error }, { data: convites }, { data: agendas }] = await Promise.all([
    admin.from('reminders').select(EVENTO_COLS).eq('profile_id', profileId).order('data_hora', { ascending: true }).limit(2000),
    // Tabelas novas ainda não criadas no banco: as listas ficam vazias
    admin.from('reminder_participants').select('status, reminders(*)').eq('profile_id', profileId).limit(1000),
    admin.from('calendar_shares').select('owner_id').eq('shared_with', profileId),
  ])
  if (error) return [] // tabela de eventos ainda não criada: calendário vazio

  const donosAgenda = (agendas ?? []).map((a) => a.owner_id as string)
  const { data: deAgendas } = donosAgenda.length
    ? await admin.from('reminders').select(EVENTO_COLS).in('profile_id', donosAgenda).gte('data_hora', desde).order('data_hora', { ascending: true }).limit(2000)
    : { data: [] }

  type Convite = { status: StatusConvite; reminders: Linha | null }
  const recebidos = ((convites ?? []) as unknown as Convite[]).filter((c) => c.reminders)

  const linhasMeus = (meus ?? []).map((r) => normalizarEvento(r as Linha))
  const linhasConvite = recebidos.map((c) => ({ ...normalizarEvento(c.reminders!), meu_status: c.status }))
  const linhasAgenda = (deAgendas ?? []).map((r) => normalizarEvento(r as Linha))

  const todosIds = [...linhasMeus, ...linhasConvite, ...linhasAgenda].map((e) => e.id)
  const [participantes, donos] = await Promise.all([
    getParticipantes(admin, todosIds),
    getPessoas(admin, [...linhasConvite, ...linhasAgenda].map((e) => e.profile_id)),
  ])

  // Um mesmo evento pode chegar por mais de um caminho: o meu > convite > agenda
  const porId = new Map<string, Evento>()
  const add = (e: Linha & { meu_status?: StatusConvite }, origem: Evento['origem']) => {
    if (porId.has(e.id)) return
    porId.set(e.id, { ...e, origem, dono: origem === 'meu' ? undefined : donos.get(e.profile_id), participantes: participantes.get(e.id) ?? [] })
  }
  linhasMeus.forEach((e) => add(e, 'meu'))
  linhasConvite.forEach((e) => add(e, 'convite'))
  linhasAgenda.forEach((e) => add(e, 'agenda'))

  return [...porId.values()].sort((a, b) => a.data_hora.localeCompare(b.data_hora))
}

/** Agendas: com quem compartilho a minha e quais acompanho */
export type Agendas = { compartilhadaCom: Pessoa[]; acompanho: Pessoa[] }

export async function getAgendas(profileId: string): Promise<Agendas> {
  const admin = createAdminClient()
  const [{ data: minhas }, { data: recebidas }] = await Promise.all([
    admin.from('calendar_shares').select('shared_with, shared_with_email').eq('owner_id', profileId),
    admin.from('calendar_shares').select('owner_id').eq('shared_with', profileId),
  ])
  const pessoas = await getPessoas(admin, [...(minhas ?? []).map((m) => m.shared_with), ...(recebidas ?? []).map((r) => r.owner_id)])
  const ordenar = (l: Pessoa[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return {
    compartilhadaCom: ordenar((minhas ?? []).map((m) => ({ ...(pessoas.get(m.shared_with) ?? { id: m.shared_with, nome: m.shared_with_email, avatar_url: null }), email: m.shared_with_email }))),
    acompanho: ordenar((recebidas ?? []).map((r) => pessoas.get(r.owner_id)).filter((p): p is Pessoa => !!p)),
  }
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
  return (data as Linha[])
    .map((r) => ({ ...normalizarEvento(r), origem: 'meu' as const, participantes: [] }))
    .filter((e) => horaAviso(e) <= agora)
}

/** Notificações do calendário além dos avisos dos próprios eventos: convites e agendas compartilhadas */
export type AvisoCalendario = {
  id: string
  tipo: 'convite' | 'agenda' | 'lembrete_convite'
  titulo: string
  detalhe: string
  /** Para onde a notificação leva */
  evento_id: string | null
  /** Momento da notificação (para ordenar) */
  em: string
  visto: boolean
}

export async function getAvisosCalendario(profileId: string, limite = 50): Promise<AvisoCalendario[]> {
  const admin = createAdminClient()
  const agora = Date.now()
  const [{ data: convites }, { data: agendas }] = await Promise.all([
    admin.from('reminder_participants')
      .select('id, status, created_at, aviso_visto_em, lembrete_visto_em, reminders(id, profile_id, titulo, data_hora, notificar, antecedencia_min, concluido)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(300),
    admin.from('calendar_shares').select('id, owner_id, created_at, aviso_visto_em').eq('shared_with', profileId).order('created_at', { ascending: false }).limit(limite),
  ])

  type Convite = {
    id: string; status: StatusConvite; created_at: string; aviso_visto_em: string | null; lembrete_visto_em: string | null
    reminders: { id: string; profile_id: string; titulo: string; data_hora: string; notificar: boolean; antecedencia_min: number; concluido: boolean } | null
  }
  const lista = ((convites ?? []) as unknown as Convite[]).filter((c) => c.reminders)
  const pessoas = await getPessoas(admin, [...lista.map((c) => c.reminders!.profile_id), ...(agendas ?? []).map((a) => a.owner_id)])
  const nome = (id: string) => pessoas.get(id)?.nome ?? 'Outro usuário'
  const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

  const avisos: AvisoCalendario[] = []
  // Convite recebido: um aviso por série (as ocorrências seguintes chegam juntas)
  const seriesVistas = new Set<string>()
  for (const c of lista) {
    const r = c.reminders!
    const chave = `${r.titulo}|${r.profile_id}|${c.created_at.slice(0, 16)}`
    if (!seriesVistas.has(chave)) {
      seriesVistas.add(chave)
      avisos.push({
        id: 'c-' + c.id, tipo: 'convite', titulo: r.titulo,
        detalhe: `${nome(r.profile_id)} convidou você · ${quando(r.data_hora)}`,
        evento_id: r.id, em: c.created_at, visto: !!c.aviso_visto_em,
      })
    }
    // Aviso do horário do evento para quem foi convidado e não recusou
    const horaDoAviso = new Date(r.data_hora).getTime() - r.antecedencia_min * 60_000
    if (r.notificar && !r.concluido && c.status !== 'recusado' && horaDoAviso <= agora && horaDoAviso > agora - 7 * 86_400_000) {
      avisos.push({
        id: 'l-' + c.id, tipo: 'lembrete_convite', titulo: r.titulo,
        detalhe: `Evento de ${nome(r.profile_id)} · ${quando(r.data_hora)}`,
        evento_id: r.id, em: new Date(horaDoAviso).toISOString(), visto: !!c.lembrete_visto_em,
      })
    }
  }
  for (const a of agendas ?? []) {
    avisos.push({
      id: 'a-' + a.id, tipo: 'agenda', titulo: `Agenda de ${nome(a.owner_id)}`,
      detalhe: `${nome(a.owner_id)} compartilhou a agenda com você`,
      evento_id: null, em: a.created_at, visto: !!a.aviso_visto_em,
    })
  }
  return avisos.sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite)
}

/** Próximo aviso de horário de um evento para o qual fui convidado (para o sino avisar no minuto exato) */
export async function getProximoAvisoConvite(profileId: string): Promise<number | null> {
  const admin = createAdminClient()
  const agora = Date.now()
  const { data } = await admin
    .from('reminder_participants')
    .select('status, reminders(data_hora, notificar, antecedencia_min, concluido)')
    .eq('profile_id', profileId)
    .neq('status', 'recusado')
    .limit(500)
  type Row = { reminders: { data_hora: string; notificar: boolean; antecedencia_min: number; concluido: boolean } | null }
  const futuros = ((data ?? []) as unknown as Row[])
    .map((r) => r.reminders)
    .filter((r): r is NonNullable<Row['reminders']> => !!r && r.notificar && !r.concluido)
    .map((r) => new Date(r.data_hora).getTime() - r.antecedencia_min * 60_000)
    .filter((t) => t > agora)
  return futuros.length ? Math.min(...futuros) : null
}
