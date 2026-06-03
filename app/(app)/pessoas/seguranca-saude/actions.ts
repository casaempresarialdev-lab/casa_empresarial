'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createHealthSafetyAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const titulo = formData.get('titulo') as string
  if (!titulo?.trim()) return { error: 'Título é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('health_safety_records').insert({
    company_id: companyId,
    employee_id: (formData.get('employee_id') as string) || null,
    tipo: formData.get('tipo') as string,
    titulo: titulo.trim(),
    data: (formData.get('data') as string) || null,
    data_vencimento: (formData.get('data_vencimento') as string) || null,
    resultado: (formData.get('resultado') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/seguranca-saude')
  return { success: true }
}

export async function updateHealthSafetyAction(recordId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('health_safety_records').update({
    employee_id: (formData.get('employee_id') as string) || null,
    tipo: formData.get('tipo') as string,
    titulo: (formData.get('titulo') as string).trim(),
    data: (formData.get('data') as string) || null,
    data_vencimento: (formData.get('data_vencimento') as string) || null,
    resultado: (formData.get('resultado') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }).eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/seguranca-saude')
  return { success: true }
}

export async function deleteHealthSafetyAction(recordId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('health_safety_records').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/seguranca-saude')
  return { success: true }
}
