import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, motivoNaoEnviado } from '@/lib/email'
import { getEmailBranding, layoutEmail } from '@/lib/email-template'

// Códigos de 6 números enviados por e-mail para confirmar identidade — só no servidor.
// Fluxo: sendEmailCode → verifyEmailCode → (operação) hasVerifiedEmailCode → consumeEmailCodes

export type Finalidade = 'ativar_2fa' | 'desativar_2fa' | 'pin' | 'senha'

const VALIDADE_MIN = 10
const MAX_TENTATIVAS = 5
const REENVIO_SEG = 60
/** Depois de confirmado, por quanto tempo a confirmação vale para concluir a operação */
const CONFIRMACAO_VALE_MIN = 15

const ASSUNTO: Record<Finalidade, string> = {
  ativar_2fa: 'Código para ativar a autenticação em 2 fatores',
  desativar_2fa: 'Código para desativar a autenticação em 2 fatores',
  pin: 'Código para alterar o PIN de segurança',
  senha: 'Código para alterar a sua senha',
}

function hashCode(code: string) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback-key-set-env').update(code).digest('hex')
}

export async function sendEmailCode(profileId: string, email: string, finalidade: Finalidade) {
  const admin = createAdminClient()

  // Evita reenvios em sequência
  const { data: ultimo } = await admin
    .from('email_verification_codes')
    .select('created_at')
    .eq('profile_id', profileId)
    .eq('finalidade', finalidade)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < REENVIO_SEG * 1000) {
    return { error: 'Aguarde um minuto antes de pedir um novo código.' }
  }

  // Um código ativo por vez
  await admin.from('email_verification_codes').delete().eq('profile_id', profileId).eq('finalidade', finalidade)

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const { error } = await admin.from('email_verification_codes').insert({
    profile_id: profileId,
    finalidade,
    code_hash: hashCode(code),
    expira_em: new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString(),
  })
  if (error) return { error: error.message }

  const sent = await sendEmail({
    to: email,
    subject: ASSUNTO[finalidade],
    text: `Seu código de verificação da Casa Empresarial é ${code}. Ele vale por ${VALIDADE_MIN} minutos. Se não foi você, ignore este e-mail e troque sua senha.`,
    // Código é da conta (não de uma empresa): marca padrão da Casa Empresarial
    html: layoutEmail({
      branding: await getEmailBranding(null),
      previa: `Seu código de verificação: ${code}`,
      titulo: 'Confirme que é você',
      blocos: [
        { tipo: 'texto', html: 'Use o código abaixo para continuar:' },
        { tipo: 'codigo', codigo: code },
        { tipo: 'nota', html: `O código vale por <strong>${VALIDADE_MIN} minutos</strong>.` },
        { tipo: 'nota', html: 'Se não foi você que pediu, ignore este e-mail e troque a sua senha.' },
      ],
    }),
  })
  if (sent.status === 'enviado') return { success: true, aviso: null }

  // Desenvolvimento sem e-mail configurado: o código vale (está no terminal), mas a tela avisa que não foi enviado
  if (sent.status === 'nao_configurado' && process.env.NODE_ENV !== 'production') {
    return {
      success: true,
      aviso: `O e-mail NÃO foi enviado: ${motivoNaoEnviado(sent)}. Em desenvolvimento, use o código mostrado no terminal do servidor.`,
    }
  }

  // Sem envio de verdade o código não serve: apaga e informa o motivo exato
  await admin.from('email_verification_codes').delete().eq('profile_id', profileId).eq('finalidade', finalidade)
  return { error: `O e-mail NÃO foi enviado: ${motivoNaoEnviado(sent)}.` }
}

export async function verifyEmailCode(profileId: string, finalidade: Finalidade, code: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('email_verification_codes')
    .select('id, code_hash, expira_em, tentativas')
    .eq('profile_id', profileId)
    .eq('finalidade', finalidade)
    .is('verificado_em', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data || new Date(data.expira_em) < new Date()) return { error: 'Código expirado. Peça um novo.' }
  if (data.tentativas >= MAX_TENTATIVAS) return { error: 'Muitas tentativas. Peça um novo código.' }

  const esperado = Buffer.from(data.code_hash, 'hex')
  const recebido = Buffer.from(hashCode(code.replace(/\D/g, '')), 'hex')
  if (!timingSafeEqual(esperado, recebido)) {
    await admin.from('email_verification_codes').update({ tentativas: data.tentativas + 1 }).eq('id', data.id)
    return { error: 'Código incorreto.' }
  }

  await admin.from('email_verification_codes').update({ verificado_em: new Date().toISOString() }).eq('id', data.id)
  return { success: true }
}

/** Registra a identidade como confirmada por outro meio (ex.: código do app autenticador) */
export async function marcarIdentidadeConfirmada(profileId: string, finalidade: Finalidade) {
  const admin = createAdminClient()
  await admin.from('email_verification_codes').delete().eq('profile_id', profileId).eq('finalidade', finalidade)
  const agora = new Date()
  await admin.from('email_verification_codes').insert({
    profile_id: profileId,
    finalidade,
    code_hash: hashCode(String(randomInt(0, 1_000_000))), // não é usado: a confirmação já aconteceu
    expira_em: new Date(agora.getTime() + VALIDADE_MIN * 60_000).toISOString(),
    verificado_em: agora.toISOString(),
  })
}

/** Se a identidade foi confirmada (e-mail ou app) há pouco, para concluir a operação */
export async function hasVerifiedEmailCode(profileId: string, finalidade: Finalidade) {
  const admin = createAdminClient()
  const desde = new Date(Date.now() - CONFIRMACAO_VALE_MIN * 60_000).toISOString()
  const { data } = await admin
    .from('email_verification_codes')
    .select('id')
    .eq('profile_id', profileId)
    .eq('finalidade', finalidade)
    .gte('verificado_em', desde)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function consumeEmailCodes(profileId: string, finalidade: Finalidade) {
  const admin = createAdminClient()
  await admin.from('email_verification_codes').delete().eq('profile_id', profileId).eq('finalidade', finalidade)
}
