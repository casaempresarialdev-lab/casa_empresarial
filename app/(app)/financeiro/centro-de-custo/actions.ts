'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createCostCenterAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('cost_centers').insert({
    company_id: companyId,
    nome,
    codigo: (formData.get('codigo') as string) || null,
    ativo: formData.get('ativo') === 'true',
  })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/centro-de-custo')
  return { success: true }
}

export async function updateCostCenterAction(costCenterId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = formData.get('nome') as string
  if (!nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('cost_centers').update({
    nome,
    codigo: (formData.get('codigo') as string) || null,
    ativo: formData.get('ativo') === 'true',
  }).eq('id', costCenterId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/centro-de-custo')
  return { success: true }
}

export async function deleteCostCenterAction(costCenterId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('cost_centers').delete().eq('id', costCenterId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/centro-de-custo')
  return { success: true }
}
