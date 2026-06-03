import { createAdminClient } from '@/lib/supabase/server'

export type CostCenter = {
  id: string
  company_id: string
  nome: string
  codigo: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export async function getCostCenters(companyId: string): Promise<CostCenter[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cost_centers')
    .select('id, company_id, nome, codigo, ativo, created_at, updated_at')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as CostCenter[]
}
