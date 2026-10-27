import { createAdminClient } from '@/lib/supabase/server'

export type Certificate = {
  id: string
  identificacao: string
  nome_arquivo: string
  /** Se há senha cadastrada (a senha em si só sai pela action de revelar) */
  tem_senha: boolean
  created_at: string
}

export async function getCertificates(companyId: string): Promise<{ certificates: Certificate[]; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_certificates')
    .select('id, identificacao, nome_arquivo, senha_enc, created_at')
    .eq('company_id', companyId)
    .order('identificacao')

  // Ex.: tabela ainda não criada no banco
  if (error) return { certificates: [], error: error.message }

  const certificates = (data ?? []).map((c) => ({
    id: c.id,
    identificacao: c.identificacao,
    nome_arquivo: c.nome_arquivo,
    tem_senha: !!c.senha_enc,
    created_at: c.created_at,
  }))
  return { certificates, error: null }
}
