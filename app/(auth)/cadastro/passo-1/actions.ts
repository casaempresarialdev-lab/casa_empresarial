'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function saveCpfAction(userId: string, cpf: string) {
  const admin = createAdminClient()
  const digits = cpf.replace(/\D/g, '')
  // UPDATE — o perfil já existe via trigger do Supabase Auth
  await admin
    .from('profiles')
    .update({ cpf: digits })
    .eq('id', userId)
}
