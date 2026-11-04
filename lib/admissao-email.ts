import { sendEmail, type SendResult } from '@/lib/email'
import { escapeHtml, getEmailBranding, layoutEmail } from '@/lib/email-template'
import { fmtDataHora } from '@/lib/validations/admissao'

/** Carta proposta: o e-mail leva ao link público, onde o candidato lê e responde */
export async function enviarCartaProposta(opcoes: {
  companyId: string
  nome: string
  email: string
  assunto: string
  link: string
  validaAte: string
}): Promise<SendResult> {
  const { companyId, nome, email, assunto, link, validaAte } = opcoes
  const branding = await getEmailBranding(companyId)
  const primeiroNome = nome.split(' ')[0]
  const mensagem = `A ${branding.nome} enviou uma carta proposta para você. Leia as condições e responda até ${validaAte}.`

  return sendEmail({
    to: email,
    subject: assunto,
    text: `Olá, ${primeiroNome}.\n\n${mensagem}\n\nVer a carta proposta: ${link}`,
    html: layoutEmail({
      branding,
      previa: mensagem,
      titulo: 'Você recebeu uma carta proposta',
      blocos: [
        { tipo: 'texto', html: `Olá, ${escapeHtml(primeiroNome)}.` },
        { tipo: 'texto', html: escapeHtml(mensagem) },
        { tipo: 'botao', texto: 'Ver a carta proposta', url: link },
      ],
    }),
  }).catch(() => ({ status: 'falhou' as const, error: 'erro no envio' }))
}

/** Avisa quem enviou a carta que o candidato respondeu */
export async function avisarRespostaCarta(opcoes: {
  companyId: string
  para: string
  candidato: string
  aceita: boolean
  motivo?: string | null
  link: string
}) {
  const { companyId, para, candidato, aceita, motivo, link } = opcoes
  const branding = await getEmailBranding(companyId)
  const titulo = aceita ? `${candidato} aceitou a carta proposta` : `${candidato} recusou a carta proposta`
  const mensagem = aceita
    ? 'O candidato foi direcionado para preencher os dados e enviar os documentos.'
    : 'A candidatura voltou para a vaga como "Desistiu".'

  return sendEmail({
    to: para,
    subject: titulo,
    text: [mensagem, motivo ? `Motivo: ${motivo}` : null, link].filter(Boolean).join('\n\n'),
    html: layoutEmail({
      branding,
      previa: mensagem,
      titulo,
      blocos: [
        { tipo: 'texto', html: escapeHtml(mensagem) },
        ...(motivo ? [{ tipo: 'texto' as const, html: `<strong>Motivo:</strong> ${escapeHtml(motivo)}` }] : []),
        { tipo: 'botao', texto: 'Abrir o kanban de admissão', url: link },
      ],
    }),
  }).catch(() => ({ status: 'falhou' as const, error: 'erro no envio' }))
}

/** Avisa o candidato de entrevista marcada, remarcada ou cancelada */
export async function avisarEntrevista(opcoes: {
  tipo: 'agendada' | 'remarcada' | 'cancelada'
  companyId: string
  nome: string
  email: string
  vagaTitulo: string | null
  dataHora: string
  link: string | null
}): Promise<SendResult> {
  const { tipo, companyId, nome, email, vagaTitulo, dataHora, link } = opcoes
  const branding = await getEmailBranding(companyId)
  const primeiroNome = nome.split(' ')[0]
  const quando = fmtDataHora(dataHora)
  const processo = vagaTitulo ? `da vaga ${vagaTitulo} na ${branding.nome}` : `na ${branding.nome}`
  const titulo = { agendada: 'Entrevista marcada', remarcada: 'Entrevista remarcada', cancelada: 'Entrevista cancelada' }[tipo]
  const mensagem = {
    agendada: `Sua entrevista ${processo} foi marcada para ${quando} (horário de Brasília).`,
    remarcada: `Sua entrevista ${processo} foi remarcada para ${quando} (horário de Brasília).`,
    cancelada: `Sua entrevista ${processo}, marcada para ${quando}, foi cancelada.`,
  }[tipo]
  const comLink = tipo !== 'cancelada' && !!link

  return sendEmail({
    to: email,
    subject: `${titulo}: ${branding.nome}`,
    text: [`Olá, ${primeiroNome}.`, mensagem, comLink ? `Link da entrevista: ${link}` : null].filter(Boolean).join('\n\n'),
    html: layoutEmail({
      branding,
      previa: mensagem,
      titulo,
      blocos: [
        { tipo: 'texto', html: `Olá, ${escapeHtml(primeiroNome)}.` },
        { tipo: 'texto', html: escapeHtml(mensagem) },
        ...(comLink ? [{ tipo: 'botao' as const, texto: 'Entrar na entrevista', url: link! }] : []),
      ],
    }),
  }).catch(() => ({ status: 'falhou' as const, error: 'erro no envio' }))
}
