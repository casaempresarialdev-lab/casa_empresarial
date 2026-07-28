import { createAdminClient } from '@/lib/supabase/server'

export type DreGrupo =
  | 'receita_operacional'
  | 'deducao_receita'
  | 'cmv_cpv'
  | 'despesa_pessoal'
  | 'despesa_administrativa'
  | 'despesa_comercial'
  | 'outras_receitas'
  | 'receita_financeira'
  | 'despesa_financeira'
  | 'imposto'
  | 'nao_classificado'

export type Category = {
  id: string
  company_id: string
  nome: string
  tipo: 'receita' | 'despesa'
  parent_id: string | null
  cor: string | null
  icone: string | null
  ativo: boolean
  dre_grupo: DreGrupo
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
