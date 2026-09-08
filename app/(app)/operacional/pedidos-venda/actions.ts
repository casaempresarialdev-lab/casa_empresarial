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

  // Ao marcar como entregue → gera lançamento de recebimento no fluxo de caixa + baixa o estoque
  if (status === 'entregue') {
    const { data: order } = await admin
      .from('sale_orders')
      .select('numero, valor_total, cliente_id, data, data_entrega, company_id, itens')
      .eq('id', orderId)
      .single()

    // Baixa de estoque — só itens vinculados a um produto do catálogo. Bloqueia se faltar estoque.
    const itens = (order?.itens ?? []) as PedidoVendaItem[]
    const comProduto = itens.filter(i => i.product_id)
    const estoqueMap = new Map<string, number>()
    if (comProduto.length > 0) {
      const { data: produtos } = await admin
        .from('products')
        .select('id, nome, estoque_atual')
        .in('id', comProduto.map(i => i.product_id as string))

      for (const p of produtos ?? []) {
        estoqueMap.set(p.id, p.estoque_atual)
        const item = comProduto.find(i => i.product_id === p.id)
        if (item && item.qtd > p.estoque_atual) {
          return { error: `Estoque insuficiente de "${p.nome}" (disponível: ${p.estoque_atual}).` }
        }
      }
    }

    if (order && order.valor_total > 0) {
      const dataComp = order.data
      const dataVenc = order.data_entrega ?? order.data

      await admin.from('transactions').insert({
        company_id:       order.company_id,
        tipo:             'recebimento',
        descricao:        `Pedido de Venda #${order.numero}`,
        valor:            order.valor_total,
        data_competencia: dataComp,
        data_vencimento:  dataVenc,
        status:           'pendente',
        contact_id:       order.cliente_id,
        recorrente:       'false',
      })
    }

    for (const item of comProduto) {
      const atual = estoqueMap.get(item.product_id as string)
      if (atual === undefined) continue
      await admin
        .from('products')
        .update({ estoque_atual: atual - item.qtd })
        .eq('id', item.product_id as string)
    }
    if (comProduto.length > 0) revalidatePath('/operacional/produtos')
  }

  const { error } = await admin.from('sale_orders').update({ status }).eq('id', orderId)
  if (error) return { error: error.message }

  revalidatePath('/operacional/pedidos-venda')
  revalidatePath('/financeiro/fluxo-de-caixa')
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
