'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseContactFields(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    tipo: (formData.get('tipo') as string) || 'PF',
    cpf_cnpj: (formData.get('cpf_cnpj') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }
}

export async function createContactAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseContactFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('contacts').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contatos')
  return { success: true }
}

export async function updateContactAction(contactId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseContactFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('contacts').update(fields).eq('id', contactId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contatos')
  return { success: true }
}

export async function deleteContactAction(contactId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('contacts').delete().eq('id', contactId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/contatos')
  return { success: true }
}
