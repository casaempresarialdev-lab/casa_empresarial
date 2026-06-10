'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const DEFAULT_ALIQUOTAS = [
  { nome: 'FGTS', percentual: 8.00, ativo: true, ordem: 1 },
  { nome: 'INSS Patronal', percentual: 20.00, ativo: true, ordem: 2 },
  { nome: 'RAT/FAP', percentual: 2.00, ativo: true, ordem: 3 },
  { nome: 'Sistema S', percentual: 5.80, ativo: true, ordem: 4 },
  { nome: '13º Salário', percentual: 8.33, ativo: true, ordem: 5 },
  { nome: 'Férias + 1/3', percentual: 11.11, ativo: true, ordem: 6 },
]

export async function seedDefaultAliquotasAction(companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_encargos_aliquotas').insert(
    DEFAULT_ALIQUOTAS.map(a => ({ ...a, company_id: companyId }))
  )

  if (error) return { error: error.message }
  revalidatePath('/pessoas/encargos')
  return { success: true }
}

export async function createAliquotaAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = (formData.get('nome') as string)?.trim()
  const percentual = parseFloat((formData.get('percentual') as string)?.replace(',', '.') || '0')

  if (!nome) return { error: 'Nome é obrigatório.' }
  if (isNaN(percentual) || percentual < 0 || percentual > 100) return { error: 'Percentual inválido (0–100).' }

  const admin = createAdminClient()

  const { data: last } = await admin
    .from('company_encargos_aliquotas')
    .select('ordem')
    .eq('company_id', companyId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = (last?.ordem ?? 0) + 1

  const { error } = await admin.from('company_encargos_aliquotas').insert({
    company_id: companyId,
    nome,
    percentual,
    ativo: true,
    ordem,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/encargos')
  return { success: true }
}

export async function updateAliquotaAction(id: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const nome = (formData.get('nome') as string)?.trim()
  const percentual = parseFloat((formData.get('percentual') as string)?.replace(',', '.') || '0')
  const ativo = formData.get('ativo') === 'true'

  if (!nome) return { error: 'Nome é obrigatório.' }
  if (isNaN(percentual) || percentual < 0 || percentual > 100) return { error: 'Percentual inválido (0–100).' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_encargos_aliquotas')
    .update({ nome, percentual, ativo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/encargos')
  return { success: true }
}

export async function deleteAliquotaAction(id: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_encargos_aliquotas').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/encargos')
  return { success: true }
}
