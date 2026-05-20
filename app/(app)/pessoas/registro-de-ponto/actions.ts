'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parsePontoFields(formData: FormData) {
  const entrada = (formData.get('entrada') as string) || null
  const saida = (formData.get('saida') as string) || null
  const data = formData.get('data') as string

  // Combina data + hora para montar timestamptz
  const entradaTs = entrada ? `${data}T${entrada}:00` : null
  const saidaTs = saida ? `${data}T${saida}:00` : null

  return {
    employee_id: formData.get('employee_id') as string,
    data,
    entrada: entradaTs,
    saida: saidaTs,
    tipo: (formData.get('tipo') as string) || 'normal',
    observacao: (formData.get('observacao') as string) || null,
  }
}

export async function createTimeRecordAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePontoFields(formData)
  if (!fields.employee_id) return { error: 'Selecione um funcionário.' }
  if (!fields.data) return { error: 'Data é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('time_records').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/registro-de-ponto')
  return { success: true }
}

export async function updateTimeRecordAction(recordId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePontoFields(formData)

  const admin = createAdminClient()
  const { error } = await admin.from('time_records').update(fields).eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/registro-de-ponto')
  return { success: true }
}

export async function deleteTimeRecordAction(recordId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('time_records').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/registro-de-ponto')
  return { success: true }
}
