'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseProviderFields(formData: FormData) {
  const valorRaw = formData.get('valor') as string
  const valor = valorRaw ? parseFloat(valorRaw.replace(',', '.')) : null
  return {
    nome: formData.get('nome') as string,
    tipo: (formData.get('tipo') as string) || 'PJ',
    cpf_cnpj: (formData.get('cpf_cnpj') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    servico: (formData.get('servico') as string) || null,
    valor,
  }
}

export async function createProviderAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProviderFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_providers').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/prestadores')
  return { success: true }
}

export async function updateProviderAction(providerId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProviderFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_providers').update(fields).eq('id', providerId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/prestadores')
  return { success: true }
}

export async function deleteProviderAction(providerId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_providers').delete().eq('id', providerId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/prestadores')
  return { success: true }
}
