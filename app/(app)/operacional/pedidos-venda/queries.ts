import { createAdminClient } from '@/lib/supabase/server'

export type PedidoVendaItem = {
  product_id: string | null
  nome: string
  qtd: number
  preco_unitario: number
  subtotal: number
}

export type SaleOrder = {
  id: string
  company_id: string
  numero: number
  cliente_id: string | null
  data: string
  data_entrega: string | null
  status: 'rascunho' | 'confirmado' | 'em_producao' | 'enviado' | 'entregue' | 'cancelado'
  itens: PedidoVendaItem[]
  desconto: number
  valor_total: number
  forma_pagamento: string | null
  observacao: string | null
  created_at: string
  updated_at: string
  cliente?: { nome: string } | null
}

export async function getSaleOrders(companyId: string): Promise<SaleOrder[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sale_orders')
    .select('*, cliente:contacts(nome)')
    .eq('company_id', companyId)
    .order('numero', { ascending: false })

  if (error) throw error
  return (data ?? []) as SaleOrder[]
}

export async function getContacts(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('id, nome, tipo')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) return []
  return (data ?? []) as { id: string; nome: string; tipo: string }[]
}

export async function getActiveProducts(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('id, nome, preco_venda, unidade_medida')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) return []
  return (data ?? []) as { id: string; nome: string; preco_venda: number | null; unidade_medida: string }[]
}
