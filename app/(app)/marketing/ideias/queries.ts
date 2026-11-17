import { createAdminClient } from '@/lib/supabase/server'

export type IdeiaMarketing = {
  id: string
  company_id: string
  titulo: string
  formato: string | null
  notas: string | null
  status: 'ideia' | 'promovida' | 'descartada'
  created_at: string
  updated_at: string
}

export async function getIdeiasMarketing(companyId: string): Promise<IdeiaMarketing[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ideias_marketing')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as IdeiaMarketing[]
}
