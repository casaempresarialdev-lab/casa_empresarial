'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PedidoItem } from './queries'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parsePedidoFields(formData: FormData) {
  const itensRaw = formData.get('itens') as string
  const itens: PedidoItem[] = itensRaw ? JSON.parse(itensRaw) : []
  const valorTotal = itens.reduce((sum, i) => sum + i.subtotal, 0)

  return {
    fornecedor_id: (formData.get('fornecedor_id') as string) || null,
    data: (formData.get('data') as string) || new Date().toISOString().slice(0, 10),
    data_entrega: (formData.get('data_entrega') as string) || null,
    status: (formData.get('status') as string) || 'rascunho',
    itens,
    valor_total: valorTotal,
    observacao: (formData.get('observacao') as string) || null,
  }
}

export async function createPurchaseOrderAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePedidoFields(formData)

  const admin = createAdminClient()
  const { error } = await admin
    .from('purchase_orders')
    .insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-compra')
  return { success: true }
}

export async function updatePurchaseOrderAction(orderId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePedidoFields(formData)

  const admin = createAdminClient()
  const { error } = await admin.from('purchase_orders').update(fields).eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-compra')
  return { success: true }
}

export async function updatePurchaseOrderStatusAction(orderId: string, status: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Ao marcar como recebido → gera lançamento de pagamento no fluxo de caixa
  if (status === 'recebido') {
    const { data: order } = await admin
      .from('purchase_orders')
      .select('numero, valor_total, fornecedor_id, data, data_entrega, company_id')
      .eq('id', orderId)
      .single()

    if (order && order.valor_total > 0) {
      const dataComp = order.data
      const dataVenc = order.data_entrega ?? order.data

      await admin.from('transactions').insert({
        company_id:      order.company_id,
        tipo:            'pagamento',
        descricao:       `Pedido de Compra #${order.numero}`,
        valor:           order.valor_total,
        data_competencia: dataComp,
        data_vencimento:  dataVenc,
        status:          'pendente',
        contact_id:      order.fornecedor_id,
        recorrente:      'false',
      })
    }
  }

  const { error } = await admin.from('purchase_orders').update({ status }).eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath('/operacional/pedidos-compra')
  revalidatePath('/financeiro/fluxo-de-caixa')
  return { success: true }
}

export async function deletePurchaseOrderAction(orderId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('purchase_orders').delete().eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-compra')
  return { success: true }
}
