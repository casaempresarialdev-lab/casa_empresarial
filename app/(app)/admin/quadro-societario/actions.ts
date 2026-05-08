'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createSocioAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const participacaoRaw = formData.get('participacao') as string
  const participacao = participacaoRaw ? parseFloat(participacaoRaw) : null

  if (participacao !== null && (participacao < 0 || participacao > 100)) {
    return { error: 'Participação deve ser entre 0 e 100%.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').insert({
    company_id: companyId,
    nome: formData.get('nome') as string,
    cpf: (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    participacao,
    cargo: (formData.get('cargo') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

export async function updateSocioAction(socioId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const participacaoRaw = formData.get('participacao') as string
  const participacao = participacaoRaw ? parseFloat(participacaoRaw) : null

  if (participacao !== null && (participacao < 0 || participacao > 100)) {
    return { error: 'Participação deve ser entre 0 e 100%.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').update({
    nome: formData.get('nome') as string,
    cpf: (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    participacao,
    cargo: (formData.get('cargo') as string) || null,
  }).eq('id', socioId)

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

export async function deleteSocioAction(socioId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').delete().eq('id', socioId)

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}
