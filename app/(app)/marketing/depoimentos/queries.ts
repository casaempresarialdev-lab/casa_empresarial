import { createAdminClient } from '@/lib/supabase/server'

export type Depoimento = {
  id: string
  company_id: string
  cliente: string
  fonte: 'whatsapp' | 'instagram' | 'email' | 'presencial' | 'outro'
  fonte_outro: string | null
  data: string | null
  texto: string
  destaque: boolean
  created_at: string
  updated_at: string
}

export async function getDepoimentos(companyId: string): Promise<Depoimento[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('depoimentos')
    .select('*')
    .eq('company_id', companyId)
    .order('destaque', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Depoimento[]
}
