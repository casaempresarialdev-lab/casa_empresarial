'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseDepoimentoFields(formData: FormData) {
  return {
    cliente: formData.get('cliente') as string,
    fonte: (formData.get('fonte') as string) || 'outro',
    fonte_outro: (formData.get('fonte_outro') as string) || null,
    data: (formData.get('data') as string) || null,
    texto: formData.get('texto') as string,
    destaque: formData.get('destaque') === 'true',
  }
}

export async function createDepoimentoAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.depoimentos', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseDepoimentoFields(formData)
  if (!fields.cliente) return { error: 'Cliente / empresa é obrigatório.' }
  if (!fields.texto) return { error: 'Depoimento é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('depoimentos').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/marketing/depoimentos')
  return { success: true }
}

export async function updateDepoimentoAction(id: string, formData: FormData) {
  const negado = await semAcesso('marketing.depoimentos')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseDepoimentoFields(formData)
  if (!fields.cliente) return { error: 'Cliente / empresa é obrigatório.' }
  if (!fields.texto) return { error: 'Depoimento é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('depoimentos').update(fields).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/depoimentos')
  return { success: true }
}

export async function toggleDepoimentoDestaqueAction(id: string, destaque: boolean) {
  const negado = await semAcesso('marketing.depoimentos')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('depoimentos').update({ destaque }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/depoimentos')
  return { success: true }
}

export async function deleteDepoimentoAction(id: string) {
  const negado = await semAcesso('marketing.depoimentos')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('depoimentos').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/depoimentos')
  return { success: true }
}
