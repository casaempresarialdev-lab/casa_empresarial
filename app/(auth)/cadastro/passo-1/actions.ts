'use server'

import { createAdminClient } from '@/lib/supabase/server'

export async function saveCpfAction(userId: string, cpf: string) {
  const admin = createAdminClient()
  const digits = cpf.replace(/\D/g, '')
  await admin
    .from('profiles')
    .upsert({ id: userId, cpf: digits }, { onConflict: 'id' })
}
