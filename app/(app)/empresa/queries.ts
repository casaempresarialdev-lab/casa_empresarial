import { createAdminClient } from '@/lib/supabase/server'

export type Company = {
  id: string
  cnpj: string
  razao_social: string
  nome_fantasia: string | null
  regime_tributario: string | null
  telefone: string | null
  email: string | null
  ie_situacao: string | null
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

export type CompanyBank = {
  id: string
  banco: string
  tipo_conta: 'corrente' | 'poupanca' | 'pagamento' | null
  agencia: string | null
  conta: string | null
  digito: string | null
  pix_tipo: 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null
  pix_chave: string | null
  principal: boolean
}

export async function getCompanyBanks(companyId: string): Promise<CompanyBank[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_bank_details')
    .select('id, banco, tipo_conta, agencia, conta, digito, pix_tipo, pix_chave, principal')
    .eq('company_id', companyId)
    .order('ordem', { ascending: true })

  if (error) return []
  return (data ?? []) as CompanyBank[]
}

export async function getCompany(companyId: string): Promise<Company | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .select(
      'id, cnpj, razao_social, nome_fantasia, regime_tributario, telefone, email, ' +
      'ie_situacao, inscricao_estadual, inscricao_municipal, cor_primaria, logo_url, certificado_digital_url, ' +
      'cep, uf, cidade, logradouro, bairro, numero, complemento',
    )
    .eq('id', companyId)
    .single()

  if (error) return null
  return data as unknown as Company
}
