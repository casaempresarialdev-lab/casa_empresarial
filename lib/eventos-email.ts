import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getEmailBranding, layoutEmail, escapeHtml } from '@/lib/email-template'
import { descreverRepeticao } from '@/lib/validations/evento'

// Envio dos avisos de eventos do calendário por e-mail ("Também por e-mail") — só no servidor.
// Chamado pela rotina agendada (todos os usuários) e pelo próprio sistema aberto (só o usuário logado).
// Cada evento é "reservado" antes de enviar (email_enviado_em preenchido só se ainda estava vazio),
// então rotina e sistema aberto nunca mandam o mesmo aviso duas vezes.

type Admin = ReturnType<typeof createAdminClient>

const quandoFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

export async function enviarAvisosEventos(admin: Admin, so?: { profileId: string; email: string }) {
  const agora = Date.now()
  // Busca até 1 dia à frente (maior antecedência) e filtra pela hora do aviso de cada um
  let q = admin
    .from('reminders')
    .select('id, profile_id, titulo, descricao, data_hora, antecedencia_min')
    .eq('notificar', true)
    .eq('notificar_email', true)
    .eq('concluido', false)
    .is('email_enviado_em', null)
    .lte('data_hora', new Date(agora + 24 * 60 * 60 * 1000).toISOString())
    .limit(200)
  if (so) q = q.eq('profile_id', so.profileId)
  const { data, error } = await q
  if (error) return { verificados: 0, enviados: 0, falhas: 0, erro: error.message }

  const devidos = (data ?? []).filter((l) => new Date(l.data_hora).getTime() - l.antecedencia_min * 60_000 <= agora)
  if (!devidos.length) return { verificados: 0, enviados: 0, falhas: 0 }

  const branding = await getEmailBranding(null)
  const emailPorPerfil = new Map<string, string | null>(so ? [[so.profileId, so.email]] : [])
  let enviados = 0
  let falhas = 0

  for (const l of devidos) {
    // Reserva o evento: se outro processo já pegou, pula
    const { data: reservado } = await admin
      .from('reminders')
      .update({ email_enviado_em: new Date().toISOString() })
      .eq('id', l.id)
      .is('email_enviado_em', null)
      .select('id')
    if (!reservado?.length) continue

    if (!emailPorPerfil.has(l.profile_id)) {
      const { data: u } = await admin.auth.admin.getUserById(l.profile_id)
      emailPorPerfil.set(l.profile_id, u?.user?.email ?? null)
    }
    const email = emailPorPerfil.get(l.profile_id)

    const quando = quandoFormat.format(new Date(l.data_hora))
    const envio = email
      ? await sendEmail({
          to: email,
          subject: `Evento: ${l.titulo}`,
          text: `Evento: ${l.titulo}\n${quando}${l.descricao ? `\n\n${l.descricao}` : ''}`,
          html: layoutEmail({
            branding,
            previa: `${l.titulo} — ${quando}`,
            titulo: l.titulo,
            blocos: [
              { tipo: 'texto', html: `<strong>${escapeHtml(quando.charAt(0).toUpperCase() + quando.slice(1))}</strong>` },
              ...(l.descricao ? [{ tipo: 'texto' as const, html: escapeHtml(l.descricao).replace(/\n/g, '<br>') }] : []),
              { tipo: 'nota', html: 'Você recebeu este aviso porque marcou "Também por e-mail" neste evento do calendário.' },
            ],
          }),
        })
      : null

    if (envio?.status === 'enviado') {
      enviados++
    } else {
      // Não saiu: libera para tentar de novo na próxima verificação
      await admin.from('reminders').update({ email_enviado_em: null }).eq('id', l.id)
      falhas++
      console.error('[eventos] e-mail não enviado:', l.id, envio ?? 'usuário sem e-mail')
    }
  }

  return { verificados: devidos.length, enviados, falhas }
}

const horaFimFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Convite para um evento (uma vez por série): data, duração, local ou link e quem convidou */
export async function enviarConviteEvento(opcoes: {
  para: string[]
  donoNome: string
  link: string
  evento: {
    titulo: string; descricao: string | null; data_hora: string; duracao_min: number
    local: string | null; link_reuniao: string | null
    recorrencia: 'diaria' | 'semanal' | 'mensal' | 'anual' | null; recorrencia_ate: string | null; dias_semana: number[] | null
    intervalo?: number | null; ocorrencias?: number | null
  }
}) {
  const { para, donoNome, link, evento: e } = opcoes
  if (!para.length) return []
  const branding = await getEmailBranding(null)
  const inicio = new Date(e.data_hora)
  const quando = `${quandoFormat.format(inicio)} às ${horaFimFormat.format(new Date(inicio.getTime() + e.duracao_min * 60_000))}`
  const quandoCap = quando.charAt(0).toUpperCase() + quando.slice(1)
  // Dia do mês e mês no fuso do Brasil (para "Mensal: no dia 30" e "Anual: em 30 de outubro")
  const [mes, diaMes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(inicio).split('-').slice(1).map(Number)
  const repete = descreverRepeticao(e, { diaMes, mes: mes - 1 })
  // Presencial, online ou híbrido (os dois)
  const onde = e.local && e.link_reuniao ? `Híbrido: ${e.local} ou online` : e.local ? `Presencial: ${e.local}` : e.link_reuniao ? 'Online' : null

  return Promise.all(para.map((to) => sendEmail({
    to,
    subject: `Convite: ${e.titulo}`,
    text: [`${donoNome} convidou você para "${e.titulo}"`, quandoCap, repete, onde, e.link_reuniao ? `Link da reunião: ${e.link_reuniao}` : null, e.descricao, `Responder: ${link}`].filter(Boolean).join('\n'),
    html: layoutEmail({
      branding,
      previa: `${donoNome} convidou você — ${quandoCap}`,
      titulo: e.titulo,
      blocos: [
        { tipo: 'texto', html: `<strong>${escapeHtml(donoNome)}</strong> convidou você para este evento.` },
        { tipo: 'texto', html: [`<strong>${escapeHtml(quandoCap)}</strong>`, repete && escapeHtml(repete), onde && escapeHtml(onde)].filter(Boolean).join('<br>') },
        ...(e.descricao ? [{ tipo: 'texto' as const, html: escapeHtml(e.descricao).replace(/\n/g, '<br>') }] : []),
        ...(e.link_reuniao ? [{ tipo: 'botao' as const, texto: 'Entrar na reunião', url: e.link_reuniao }] : []),
        { tipo: 'botao', texto: 'Ver e responder o convite', url: link },
        { tipo: 'nota', html: 'O evento já aparece no seu calendário da Casa Empresarial, onde você pode aceitar ou recusar.' },
      ],
    }),
  })))
}

/** Aviso de que alguém compartilhou a agenda (o destinatário passa a acompanhar, só visualização) */
export async function enviarAgendaCompartilhada(opcoes: { para: string; donoNome: string; link: string }) {
  const branding = await getEmailBranding(null)
  return sendEmail({
    to: opcoes.para,
    subject: `${opcoes.donoNome} compartilhou a agenda com você`,
    text: `${opcoes.donoNome} compartilhou a agenda com você na Casa Empresarial. Veja no calendário: ${opcoes.link}`,
    html: layoutEmail({
      branding,
      previa: `Agora você acompanha a agenda de ${opcoes.donoNome}`,
      titulo: 'Agenda compartilhada',
      blocos: [
        { tipo: 'texto', html: `<strong>${escapeHtml(opcoes.donoNome)}</strong> compartilhou a agenda com você. Os eventos aparecem no seu calendário, só para visualização.` },
        { tipo: 'botao', texto: 'Abrir o calendário', url: opcoes.link },
        { tipo: 'nota', html: 'Você pode esconder esta agenda ou deixar de acompanhá-la em "Agendas", no calendário.' },
      ],
    }),
  })
}
