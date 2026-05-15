'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cadastroPasso2Schema } from '@/lib/validations/auth'

export async function saveAddressAction(data: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const parsed = cadastroPasso2Schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      cep: parsed.data.cep.replace(/\D/g, ''),
      uf: parsed.data.uf,
      cidade: parsed.data.cidade,
      logradouro: parsed.data.logradouro,
      bairro: parsed.data.bairro,
      numero: parsed.data.numero,
      complemento: parsed.data.complemento || null,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  redirect('/dashboard')
}
