import { createAdminClient } from '@/lib/supabase/server'

export type Contact = {
  id: string
  company_id: string
  nome: string
  tipo: 'PF' | 'PJ'
  papel: 'cliente' | 'fornecedor' | 'ambos'
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: Record<string, string> | null
  foto_url: string | null
  observacao: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export async function getContactById(id: string, companyId: string): Promise<Contact | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (error) return null
  return data as Contact
}

export async function getContacts(companyId: string): Promise<Contact[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Contact[]
}

export type PedidoDoContato = {
  id: string
  numero: number
  data: string
  status: string
  valor_total: number
  itens: { product_id: string | null; nome: string; qtd: number }[]
}

// Pedidos de compra feitos com este contato como fornecedor — alimenta a aba de histórico/produtos da ficha
export async function getPedidosCompraDoContato(fornecedorId: string, companyId: string): Promise<PedidoDoContato[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('purchase_orders')
    .select('id, numero, data, status, valor_total, itens')
    .eq('company_id', companyId)
    .eq('fornecedor_id', fornecedorId)
    .order('data', { ascending: false })

  if (error) return []
  return (data ?? []) as PedidoDoContato[]
}

// Pedidos de venda feitos com este contato como cliente — idem, do lado de vendas
export async function getPedidosVendaDoContato(clienteId: string, companyId: string): Promise<PedidoDoContato[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sale_orders')
    .select('id, numero, data, status, valor_total, itens')
    .eq('company_id', companyId)
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })

  if (error) return []
  return (data ?? []) as PedidoDoContato[]
}
