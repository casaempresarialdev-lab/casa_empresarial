import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getEmailBranding, layoutEmail, escapeHtml } from '@/lib/email-template'

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
