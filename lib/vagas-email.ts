import { sendEmail } from '@/lib/email'
import { escapeHtml, getEmailBranding, layoutEmail } from '@/lib/email-template'

/** Avisa os candidatos que o processo da vaga foi encerrado. Devolve quantos e-mails foram aceitos e quantos falharam. */
export async function avisarProcessoEncerrado(opcoes: {
  companyId: string
  vagaTitulo: string
  candidatos: { nome: string; email: string }[]
}) {
  const { companyId, vagaTitulo, candidatos } = opcoes
  if (!candidatos.length) return { enviados: 0, falhas: 0 }

  const branding = await getEmailBranding(companyId)
  const titulo = `Processo seletivo encerrado: ${vagaTitulo}`

  const resultados = await Promise.all(candidatos.map(({ nome, email }) => {
    const primeiroNome = nome.split(' ')[0]
    const mensagem = `O processo seletivo da vaga ${vagaTitulo} na ${branding.nome} foi encerrado e sua candidatura não seguirá adiante.`
    return sendEmail({
      to: email,
      subject: titulo,
      text: `Olá, ${primeiroNome}.\n\n${mensagem}\n\nAgradecemos o seu interesse.`,
      html: layoutEmail({
        branding,
        previa: mensagem,
        titulo,
        blocos: [
          { tipo: 'texto', html: `Olá, ${escapeHtml(primeiroNome)}.` },
          { tipo: 'texto', html: escapeHtml(mensagem) },
          { tipo: 'texto', html: 'Agradecemos o seu interesse.' },
        ],
      }),
    }).catch(() => ({ status: 'falhou' as const, error: 'erro no envio' }))
  }))

  const enviados = resultados.filter((r) => r.status === 'enviado').length
  return { enviados, falhas: resultados.length - enviados }
}
