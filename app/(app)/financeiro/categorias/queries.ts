import { createAdminClient } from '@/lib/supabase/server'

export type Category = {
  id: string
  company_id: string
  nome: string
  tipo: 'receita' | 'despesa'
  parent_id: string | null
  cor: string | null
  icone: string | null
  ativo: boolean
  created_at: string
}

export async function getCategories(companyId: string): Promise<Category[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('tipo', { ascending: true })
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Category[]
}
