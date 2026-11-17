'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseConteudoFields(formData: FormData) {
  return {
    titulo: formData.get('titulo') as string,
    status: (formData.get('status') as string) || 'ideia',
    formato: (formData.get('formato') as string) || null,
    formato_outro: (formData.get('formato_outro') as string) || null,
    fase: (formData.get('fase') as string) || null,
    canal: (formData.get('canal') as string) || null,
    canal_outro: (formData.get('canal_outro') as string) || null,
    data_publicacao: (formData.get('data_publicacao') as string) || null,
    objetivo: (formData.get('objetivo') as string) || null,
  }
}

export async function createConteudoMarketingAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('marketing.calendario', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseConteudoFields(formData)
  if (!fields.titulo) return { error: 'Tema / título é obrigatório.' }
  if (!fields.data_publicacao) return { error: 'Data é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('editorial_calendar').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/marketing/calendario')
  return { success: true }
}

export async function updateConteudoMarketingAction(id: string, formData: FormData) {
  const negado = await semAcesso('marketing.calendario')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseConteudoFields(formData)
  if (!fields.titulo) return { error: 'Tema / título é obrigatório.' }
  if (!fields.data_publicacao) return { error: 'Data é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('editorial_calendar').update(fields).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/calendario')
  return { success: true }
}

export async function deleteConteudoMarketingAction(id: string) {
  const negado = await semAcesso('marketing.calendario')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('editorial_calendar').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing/calendario')
  return { success: true }
}
