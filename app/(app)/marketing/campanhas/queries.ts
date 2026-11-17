import { createAdminClient } from '@/lib/supabase/server'

export type CampanhaMarketing = {
  id: string
  company_id: string
  nome: string
  objetivo: string
  canal: string | null
  data_inicio: string
  data_fim: string | null
  orcamento: number | null
  leads_gerados: number | null
  vendas_geradas: number | null
  notas: string | null
  created_at: string
  updated_at: string
}

export async function getCampanhasMarketing(companyId: string): Promise<CampanhaMarketing[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campanhas_marketing')
    .select('*')
    .eq('company_id', companyId)
    .order('data_inicio', { ascending: false })

  if (error) throw error
  return (data ?? []) as CampanhaMarketing[]
}
