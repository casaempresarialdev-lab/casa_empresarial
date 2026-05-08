import { createAdminClient } from '@/lib/supabase/server'

export type Socio = {
  id: string
  company_id: string
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  participacao: number | null
  cargo: string | null
  created_at: string
  updated_at: string
}

export async function getSocios(companyId: string): Promise<Socio[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('socios')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Socio[]
}
