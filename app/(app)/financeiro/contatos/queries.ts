import { createAdminClient } from '@/lib/supabase/server'

export type Contact = {
  id: string
  company_id: string
  nome: string
  tipo: 'PF' | 'PJ'
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: Record<string, string> | null
  observacao: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export async function getContacts(companyId: string): Promise<Contact[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Contact[]
}
