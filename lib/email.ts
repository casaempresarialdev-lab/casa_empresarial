import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// Envio de e-mails transacionais do sistema — só no servidor.
// Provedor (o primeiro configurado):
//   1. SMTP (ex.: Hostinger): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//   2. Resend: RESEND_API_KEY
// Remetente: EMAIL_FROM (ex.: "Casa Empresarial <contato@seudominio.com.br>"); sem ele, usa o SMTP_USER.
// Em desenvolvimento, sem provedor, o e-mail é mostrado no terminal do servidor em vez de enviado.

type Email = { to: string; subject: string; html: string; text: string }

/** Resultado real do envio, para a tela dizer exatamente o que aconteceu */
export type SendResult =
  | { status: 'enviado'; id: string }            // aceito pelo servidor de e-mail (id da mensagem)
  | { status: 'nao_configurado' }                // nenhum provedor configurado: nada foi enviado
  | { status: 'falhou'; error: string }

function remetente() {
  return process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Casa Empresarial <${process.env.SMTP_USER}>` : 'Casa Empresarial <onboarding@resend.dev>')
}

async function viaSmtp({ to, subject, html, text }: Email): Promise<SendResult> {
  const port = Number(process.env.SMTP_PORT || 465)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  try {
    const info = await transporter.sendMail({ from: remetente(), to, subject, html, text })
    // O servidor recusou o destinatário: não foi enviado
    if (info.rejected?.length) return { status: 'falhou', error: `O servidor de e-mail recusou o destinatário ${to}.` }
    return { status: 'enviado', id: info.messageId }
  } catch (err) {
    console.error('[e-mail] falha no SMTP:', err)
    const code = (err as { code?: string }).code
    if (code === 'EAUTH') return { status: 'falhou', error: 'Usuário ou senha do e-mail de envio incorretos (SMTP).' }
    if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET') {
      return { status: 'falhou', error: 'Não foi possível conectar ao servidor de e-mail (SMTP).' }
    }
    return { status: 'falhou', error: 'O servidor de e-mail não aceitou o envio.' }
  }
}

async function viaResend({ to, subject, html, text }: Email): Promise<SendResult> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({ from: remetente(), to, subject, html, text })
    if (error || !data?.id) {
      console.error('[e-mail] falha no Resend:', error)
      return { status: 'falhou', error: error?.message ?? 'O provedor de e-mail não confirmou o envio.' }
    }
    return { status: 'enviado', id: data.id }
  } catch (err) {
    console.error('[e-mail] erro ao chamar o Resend:', err)
    return { status: 'falhou', error: 'Não foi possível falar com o provedor de e-mail.' }
  }
}

export async function sendEmail(email: Email): Promise<SendResult> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return viaSmtp(email)
  if (process.env.RESEND_API_KEY) return viaResend(email)

  if (process.env.NODE_ENV !== 'production') {
    console.info(`\n[e-mail NÃO enviado: nenhum provedor configurado]\nPara: ${email.to}\nAssunto: ${email.subject}\n${email.text}\n`)
  }
  return { status: 'nao_configurado' }
}

/** Frase curta para a tela sobre um envio que não aconteceu */
export function motivoNaoEnviado(r: Exclude<SendResult, { status: 'enviado' }>) {
  return r.status === 'nao_configurado'
    ? 'o envio de e-mails não está configurado (faltam os dados de SMTP)'
    : r.error
}
