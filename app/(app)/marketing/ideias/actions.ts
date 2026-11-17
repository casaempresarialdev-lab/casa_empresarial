'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseIdeiaFields(formData: FormData) {
  return {
    titulo: formData.get('titulo') as string,
    formato: (formData.get('formato') as string) || null,
    notas: (formData.get('notas') as string) || null,
  }
}

export async function createIdeiaMarketingAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.ideias', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseIdeiaFields(formData)
  if (!fields.titulo) return { error: 'Ideia / tema é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('ideias_marketing').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/marketing/ideias')
  return { success: true }
}

export async function updateIdeiaMarketingAction(ideiaId: string, formData: FormData) {
  const negado = await semAcesso('marketing.ideias')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseIdeiaFields(formData)
  if (!fields.titulo) return { error: 'Ideia / tema é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('ideias_marketing').update(fields).eq('id', ideiaId)

  if (error) return { error: error.message }
  revalidatePath('/marketing/ideias')
  return { success: true }
}

export async function descartarIdeiaMarketingAction(ideiaId: string) {
  const negado = await semAcesso('marketing.ideias')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('ideias_marketing').update({ status: 'descartada' }).eq('id', ideiaId)

  if (error) return { error: error.message }
  revalidatePath('/marketing/ideias')
  return { success: true }
}

// Marca a ideia como promovida e devolve os dados pra pré-preencher o formulário do Calendário editorial
export async function promoverIdeiaMarketingAction(ideiaId: string) {
  const negado = await semAcesso('marketing.ideias')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: ideia, error: fetchErr } = await admin.from('ideias_marketing').select('*').eq('id', ideiaId).single()
  if (fetchErr || !ideia) return { error: 'Ideia não encontrada.' }

  const { error } = await admin.from('ideias_marketing').update({ status: 'promovida' }).eq('id', ideiaId)
  if (error) return { error: error.message }

  revalidatePath('/marketing/ideias')
  return { success: true, ideia: ideia as { titulo: string; formato: string | null; notas: string | null } }
}

export async function deleteIdeiaMarketingAction(ideiaId: string) {
  const negado = await semAcesso('marketing.ideias')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('ideias_marketing').delete().eq('id', ideiaId)

  if (error) return { error: error.message }
  revalidatePath('/marketing/ideias')
  return { success: true }
}
