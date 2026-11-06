import { sendEmail, type Anexo, type SendResult } from '@/lib/email'
import { escapeHtml, getEmailBranding, layoutEmail } from '@/lib/email-template'
import { fmtDataHora, preencherModelo } from '@/lib/validations/admissao'

/** Reprovação: texto das configurações da empresa. Cada parágrafo do modelo vira um bloco do e-mail. */
export async function avisarReprovacao(opcoes: {
  companyId: string
  assunto: string
  modelo: string
  nome: string
  email: string
  vagaTitulo: string | null
  cargo: string | null
}): Promise<SendResult> {
  const { companyId, assunto, modelo, nome, email, vagaTitulo, cargo } = opcoes
  const branding = await getEmailBranding(companyId)
  const valores = { nome, empresa: branding.nome, vaga: vagaTitulo ?? cargo ?? '', cargo: cargo ?? '' }
  const titulo = preencherModelo(assunto, valores)
  const texto = preencherModelo(modelo, valores)
  const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return sendEmail({
    to: email,
    subject: titulo,
    text: texto,
    html: layoutEmail({
      branding,
      previa: paragrafos[1] ?? paragrafos[0] ?? titulo,
      titulo,
      blocos: paragrafos.map((p) => ({ tipo: 'texto' as const, html: escapeHtml(p).replace(/\n/g, '<br>') })),
    }),
  }).catch(() => ({ status: 'falhou' as const, error: 'erro no envio' }))
}

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

/** Encaminhamento para o exame admissional: texto das configurações, com a guia em anexo quando houver */
export async function avisarExame(opcoes: {
  companyId: string
  assunto: string
  modelo: string
  nome: string
  email: string
  vagaTitulo: string | null
  cargo: string | null
  clinica: { nome: string; endereco: string | null; telefone: string | null }
  dataHora: string | null
  orientacoes: string | null
  guia: Anexo | null
}): Promise<SendResult> {
  const { companyId, assunto, modelo, nome, email, vagaTitulo, cargo, clinica, dataHora, orientacoes, guia } = opcoes
  const branding = await getEmailBranding(companyId)
  const valores = {
    nome,
    empresa: branding.nome,
    vaga: vagaTitulo ?? cargo ?? '',
    cargo: cargo ?? '',
    clinica: clinica.nome,
    endereco: clinica.endereco || 'Confirme com a clínica',
    telefone_clinica: clinica.telefone || 'Não informado',
    data_exame: dataHora ? `${fmtDataHora(dataHora)} (horário de Brasília)` : 'Atendimento por ordem de chegada',
    orientacoes: orientacoes || 'Nenhuma orientação especial.',
  }
  const titulo = preencherModelo(assunto, valores)
  const texto = preencherModelo(modelo, valores)
  const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const avisoGuia = 'A guia de encaminhamento está em anexo. Apresente-a na clínica, impressa ou no celular.'

  return sendEmail({
    to: email,
    subject: titulo,
    text: guia ? `${texto}\n\n${avisoGuia}` : texto,
    attachments: guia ? [guia] : undefined,
    html: layoutEmail({
      branding,
      previa: paragrafos[1] ?? paragrafos[0] ?? titulo,
      titulo,
      blocos: [
        ...paragrafos.map((p) => ({ tipo: 'texto' as const, html: escapeHtml(p).replace(/\n/g, '<br>') })),
        ...(guia ? [{ tipo: 'texto' as const, html: `<strong>${escapeHtml(avisoGuia)}</strong>` }] : []),
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
