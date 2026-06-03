'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createSurveyAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const titulo = formData.get('titulo') as string
  if (!titulo?.trim()) return { error: 'Título é obrigatório.' }

  const perguntasRaw = formData.get('perguntas') as string
  const perguntas = perguntasRaw ? JSON.parse(perguntasRaw) : []

  const admin = createAdminClient()
  const { error } = await admin.from('surveys').insert({
    company_id: companyId,
    titulo: titulo.trim(),
    descricao: (formData.get('descricao') as string) || null,
    perguntas,
    status: (formData.get('status') as string) || 'rascunho',
    data_inicio: (formData.get('data_inicio') as string) || null,
    data_fim: (formData.get('data_fim') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/pesquisas')
  return { success: true }
}

export async function updateSurveyAction(surveyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const titulo = formData.get('titulo') as string
  if (!titulo?.trim()) return { error: 'Título é obrigatório.' }

  const perguntasRaw = formData.get('perguntas') as string
  const perguntas = perguntasRaw ? JSON.parse(perguntasRaw) : []

  const admin = createAdminClient()
  const { error } = await admin.from('surveys').update({
    titulo: titulo.trim(),
    descricao: (formData.get('descricao') as string) || null,
    perguntas,
    status: (formData.get('status') as string) || 'rascunho',
    data_inicio: (formData.get('data_inicio') as string) || null,
    data_fim: (formData.get('data_fim') as string) || null,
  }).eq('id', surveyId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/pesquisas')
  return { success: true }
}

export async function deleteSurveyAction(surveyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('surveys').delete().eq('id', surveyId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/pesquisas')
  return { success: true }
}
