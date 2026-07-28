'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createBPLancamentoAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const descricao = (formData.get('descricao') as string)?.trim()
  if (!descricao) return { error: 'Descrição é obrigatória.' }

  const valor = parseFloat(formData.get('valor') as string)
  if (isNaN(valor) || valor < 0) return { error: 'Valor inválido.' }

  const tipo = formData.get('tipo') as string
  if (!tipo) return { error: 'Grupo é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('bp_lancamentos').insert({
    company_id: companyId,
    tipo,
    descricao,
    valor,
  })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/balanco')
  return { success: true }
}

export async function updateBPLancamentoAction(id: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const descricao = (formData.get('descricao') as string)?.trim()
  if (!descricao) return { error: 'Descrição é obrigatória.' }

  const valor = parseFloat(formData.get('valor') as string)
  if (isNaN(valor) || valor < 0) return { error: 'Valor inválido.' }

  const admin = createAdminClient()
  const { error } = await admin.from('bp_lancamentos').update({
    tipo: formData.get('tipo') as string,
    descricao,
    valor,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/balanco')
  return { success: true }
}

export async function deleteBPLancamentoAction(id: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('bp_lancamentos').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/balanco')
  return { success: true }
}
