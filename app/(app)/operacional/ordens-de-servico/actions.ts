'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { OrdemServicoItem } from './queries'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseOrdemFields(formData: FormData) {
  const itensRaw = formData.get('itens') as string
  const itens: OrdemServicoItem[] = itensRaw ? JSON.parse(itensRaw) : []
  const valorTotal = itens.reduce((sum, i) => sum + i.valor, 0)

  return {
    cliente_id: (formData.get('cliente_id') as string) || null,
    data: (formData.get('data') as string) || new Date().toISOString().slice(0, 10),
    status: (formData.get('status') as string) || 'aberta',
    itens,
    valor_total: valorTotal,
    forma_pagamento: (formData.get('forma_pagamento') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }
}

export async function createServiceOrderAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseOrdemFields(formData)
  const admin = createAdminClient()
  const { error } = await admin
    .from('service_orders')
    .insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/operacional/ordens-de-servico')
  return { success: true }
}

export async function updateServiceOrderAction(orderId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseOrdemFields(formData)
  const admin = createAdminClient()
  const { error } = await admin.from('service_orders').update(fields).eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/ordens-de-servico')
  return { success: true }
}

export async function updateServiceOrderStatusAction(orderId: string, status: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Ao marcar como concluída → gera lançamento de recebimento no fluxo de caixa
  if (status === 'concluida') {
    const { data: order } = await admin
      .from('service_orders')
      .select('numero, valor_total, cliente_id, data, company_id')
      .eq('id', orderId)
      .single()

    if (order && order.valor_total > 0) {
      await admin.from('transactions').insert({
        company_id:       order.company_id,
        tipo:             'recebimento',
        descricao:        `Ordem de Serviço #${order.numero}`,
        valor:            order.valor_total,
        data_competencia: order.data,
        data_vencimento:  order.data,
        status:           'pendente',
        contact_id:       order.cliente_id,
        recorrente:       'false',
      })
    }
  }

  const { error } = await admin.from('service_orders').update({ status }).eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath('/operacional/ordens-de-servico')
  revalidatePath('/financeiro/fluxo-de-caixa')
  return { success: true }
}

export async function deleteServiceOrderAction(orderId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_orders').delete().eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/ordens-de-servico')
  return { success: true }
}
