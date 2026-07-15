import { createAdminClient } from '@/lib/supabase/server'

export type Document = {
  id: string
  company_id: string
  nome: string
  storage_path: string
  tamanho: number | null
  tipo: string | null
  descricao: string | null
  vencimento: string | null
  observacao: string | null
  created_at: string
}

export async function getDocuments(companyId: string): Promise<Document[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('documents')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Document[]
}
