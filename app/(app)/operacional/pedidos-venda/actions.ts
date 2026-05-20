'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PedidoVendaItem } from './queries'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parsePedidoFields(formData: FormData) {
  const itensRaw = formData.get('itens') as string
  const itens: PedidoVendaItem[] = itensRaw ? JSON.parse(itensRaw) : []
  const descontoRaw = formData.get('desconto') as string
  const desconto = descontoRaw ? parseFloat(descontoRaw.replace(',', '.')) : 0
  const subtotal = itens.reduce((sum, i) => sum + i.subtotal, 0)
  const valorTotal = parseFloat(Math.max(0, subtotal - desconto).toFixed(2))

  return {
    cliente_id: (formData.get('cliente_id') as string) || null,
    data: (formData.get('data') as string) || new Date().toISOString().slice(0, 10),
    data_entrega: (formData.get('data_entrega') as string) || null,
    status: (formData.get('status') as string) || 'rascunho',
    itens,
    desconto,
    valor_total: valorTotal,
    forma_pagamento: (formData.get('forma_pagamento') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }
}

export async function createSaleOrderAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePedidoFields(formData)
  const admin = createAdminClient()
  const { error } = await admin
    .from('sale_orders')
    .insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-venda')
  return { success: true }
}

export async function updateSaleOrderAction(orderId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parsePedidoFields(formData)
  const admin = createAdminClient()
  const { error } = await admin.from('sale_orders').update(fields).eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-venda')
  return { success: true }
}

export async function updateSaleOrderStatusAction(orderId: string, status: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('sale_orders').update({ status }).eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-venda')
  return { success: true }
}

export async function deleteSaleOrderAction(orderId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('sale_orders').delete().eq('id', orderId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/pedidos-venda')
  return { success: true }
}
