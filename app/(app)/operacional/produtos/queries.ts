import { createAdminClient } from '@/lib/supabase/server'

export type Product = {
  id: string
  company_id: string
  nome: string
  descricao: string | null
  sku: string | null
  codigo_barras: string | null
  categoria: string | null
  tipo: 'produto' | 'servico'
  preco_venda: number | null
  preco_custo: number | null
  margem: number | null
  estoque_atual: number
  estoque_minimo: number
  unidade_medida: string
  foto_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export async function getProducts(companyId: string): Promise<Product[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Product[]
}
