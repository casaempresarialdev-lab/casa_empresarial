import { createAdminClient } from '@/lib/supabase/server'

export type ServiceProvider = {
  id: string
  company_id: string
  nome: string
  tipo: 'PF' | 'PJ'
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  servico: string | null
  valor: number | null
  created_at: string
  updated_at: string
}

export async function getServiceProviders(companyId: string): Promise<ServiceProvider[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_providers')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as ServiceProvider[]
}
