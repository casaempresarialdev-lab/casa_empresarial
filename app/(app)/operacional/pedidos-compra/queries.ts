import { createAdminClient } from '@/lib/supabase/server'

export type PedidoItem = {
  product_id: string | null
  nome: string
  qtd: number
  preco_unitario: number
  subtotal: number
}

export type PurchaseOrder = {
  id: string
  company_id: string
  numero: number
  fornecedor_id: string | null
  data: string
  data_entrega: string | null
  status: 'rascunho' | 'enviado' | 'confirmado' | 'recebido' | 'cancelado'
  itens: PedidoItem[]
  valor_total: number
  observacao: string | null
  created_at: string
  updated_at: string
  fornecedor?: { nome: string } | null
}

export async function getPurchaseOrders(companyId: string): Promise<PurchaseOrder[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('purchase_orders')
    .select('*, fornecedor:contacts(nome)')
    .eq('company_id', companyId)
    .order('numero', { ascending: false })

  if (error) throw error
  return (data ?? []) as PurchaseOrder[]
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
    .select('id, nome, preco_custo, preco_venda, unidade_medida')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .eq('tipo', 'produto')
    .order('nome', { ascending: true })

  if (error) return []
  return (data ?? []) as { id: string; nome: string; preco_custo: number | null; preco_venda: number | null; unidade_medida: string }[]
}
