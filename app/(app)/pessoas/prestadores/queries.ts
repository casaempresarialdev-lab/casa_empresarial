import { createAdminClient } from '@/lib/supabase/server'

export type ProviderDoc = {
  nome: string
  storage_path: string
  tipo: string | null
  size: number | null
  label?: string | null
}

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
  data_inicio: string | null
  documentos: (ProviderDoc | null)[]
  created_at: string
  updated_at: string
}

export function normalizeDocs(raw: unknown): (ProviderDoc | null)[] {
  const arr = Array.isArray(raw) ? raw : []
  const docs: (ProviderDoc | null)[] = [null, null, null]
  for (let i = 0; i < 3; i++) {
    const d = arr[i]
    docs[i] = d && typeof d === 'object' && 'storage_path' in d ? (d as ProviderDoc) : null
  }
  return docs
}

export async function getServiceProviders(companyId: string): Promise<ServiceProvider[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_providers')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []).map(p => ({
    ...p,
    documentos: normalizeDocs((p as { documentos?: unknown }).documentos),
  })) as ServiceProvider[]
}
