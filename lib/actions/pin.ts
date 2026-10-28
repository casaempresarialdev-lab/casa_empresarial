'use server'

import { createClient } from '@/lib/supabase/server'
import { verifySecurityPin } from '@/lib/security-pin'

/**
 * Confere o PIN de segurança do usuário logado (etapa de PIN antes de abrir um formulário protegido).
 * A ação final (ex.: salvar) confere o PIN de novo no servidor — esta checagem só libera a tela.
 */
export async function verificarPinAction(pin: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error }
  return { ok: true }
}
