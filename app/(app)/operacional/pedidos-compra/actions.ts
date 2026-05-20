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
  const { error } = await admin.from('purchase_orders').update({ status }).eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-compra')
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
