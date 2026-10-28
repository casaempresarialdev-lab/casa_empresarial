import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

// PIN de segurança (6 dígitos) do usuário — só no servidor.
// Uso em operações internas: `const r = await verifySecurityPin(user.id, pin); if (!r.ok) return { error: r.error }`

const MAX_FALHAS = 5
const BLOQUEIO_MINUTOS = 15

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `${salt.toString('base64')}:${hash.toString('base64')}`
}

function pinConfere(pin: string, stored: string): boolean {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false
  const esperado = Buffer.from(hashB64, 'base64')
  const calculado = scryptSync(pin, Buffer.from(saltB64, 'base64'), esperado.length)
  return timingSafeEqual(esperado, calculado)
}

export type PinCheck = { ok: true } | { ok: false; error: string }

/** Se o usuário já cadastrou o PIN (para a tela avisar antes de pedir) */
export async function temPinCadastrado(profileId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('id', profileId).maybeSingle()
  return !!(data as { security_pin_hash?: string | null } | null)?.security_pin_hash
}

/** Confere o PIN do usuário, com bloqueio temporário após várias falhas seguidas */
export async function verifySecurityPin(profileId: string, pin: string): Promise<PinCheck> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('security_pin_hash, security_pin_falhas, security_pin_bloqueado_ate')
    .eq('id', profileId)
    .single()

  if (!data?.security_pin_hash) return { ok: false, error: 'Você ainda não cadastrou um PIN de segurança.' }

  if (data.security_pin_bloqueado_ate && new Date(data.security_pin_bloqueado_ate) > new Date()) {
    return { ok: false, error: `PIN bloqueado por excesso de tentativas. Tente novamente em alguns minutos ou redefina pelo seu perfil.` }
  }

  if (/^\d{6}$/.test(pin) && pinConfere(pin, data.security_pin_hash)) {
    if (data.security_pin_falhas) {
      await admin.from('profiles').update({ security_pin_falhas: 0, security_pin_bloqueado_ate: null }).eq('id', profileId)
    }
    return { ok: true }
  }

  const falhas = (data.security_pin_falhas ?? 0) + 1
  const bloqueia = falhas >= MAX_FALHAS
  await admin
    .from('profiles')
    .update({
      security_pin_falhas: bloqueia ? 0 : falhas,
      security_pin_bloqueado_ate: bloqueia ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000).toISOString() : null,
    })
    .eq('id', profileId)

  if (bloqueia) return { ok: false, error: `PIN incorreto. Por segurança, o PIN foi bloqueado por ${BLOQUEIO_MINUTOS} minutos.` }
  const restantes = MAX_FALHAS - falhas
  return { ok: false, error: `PIN incorreto. ${restantes} ${restantes === 1 ? 'tentativa restante' : 'tentativas restantes'}.` }
}
