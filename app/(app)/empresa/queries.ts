import { createAdminClient } from '@/lib/supabase/server'

export type Company = {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  regime_tributario: string | null
  telefone: string | null
  email: string | null
  inscricao_estadual: string | null
  inscricao_municipal: string | null
  cor_primaria: string | null
  logo_url: string | null
  certificado_digital_url: string | null
  cep: string | null
  uf: string | null
  cidade: string | null
  logradouro: string | null
  bairro: string | null
  numero: string | null
  complemento: string | null
}

export async function getCompany(companyId: string): Promise<Company | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .select(
      'id, cnpj, razao_social, nome_fantasia, regime_tributario, telefone, email, ' +
      'inscricao_estadual, inscricao_municipal, cor_primaria, logo_url, certificado_digital_url, ' +
      'cep, uf, cidade, logradouro, bairro, numero, complemento',
    )
    .eq('id', companyId)
    .single()

  if (error) return null
  return data as Company
}
