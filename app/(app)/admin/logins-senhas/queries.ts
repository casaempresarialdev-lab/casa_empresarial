import { createAdminClient } from '@/lib/supabase/server'

export type Credential = {
  id: string
  company_id: string
  sistema: string
  login: string
  url: string | null
  observacao: string | null
  created_at: string
  updated_at: string
}

export async function getCredentials(companyId: string): Promise<Credential[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('credentials')
    .select('id, company_id, sistema, login, url, observacao, created_at, updated_at')
    .eq('company_id', companyId)
    .order('sistema', { ascending: true })

  if (error) throw error
  return (data ?? []) as Credential[]
}
