'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createCategoryAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome é obrigatório.' }

  const tipo = formData.get('tipo') as string
  if (!tipo) return { error: 'Tipo é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('categories').insert({
    company_id: companyId,
    nome,
    tipo,
    parent_id: (formData.get('parent_id') as string) || null,
    cor: (formData.get('cor') as string) || null,
    icone: (formData.get('icone') as string) || null,
    ativo: formData.get('ativo') === 'true',
  })

  if (error) {
    if (error.code === '23505') return { error: 'Já existe uma categoria com este nome neste grupo.' }
    return { error: error.message }
  }
  revalidatePath('/financeiro/categorias')
  return { success: true }
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('categories').update({
    nome,
    parent_id: (formData.get('parent_id') as string) || null,
    cor: (formData.get('cor') as string) || null,
    icone: (formData.get('icone') as string) || null,
    ativo: formData.get('ativo') === 'true',
  }).eq('id', categoryId)

  if (error) {
    if (error.code === '23505') return { error: 'Já existe uma categoria com este nome neste grupo.' }
    return { error: error.message }
  }
  revalidatePath('/financeiro/categorias')
  return { success: true }
}

export async function deleteCategoryAction(categoryId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('categories').delete().eq('id', categoryId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/categorias')
  return { success: true }
}
