import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'

export type CompanyBranding = {
  logoReduzidaUrl: string | null
  iconeUrl: string | null
  corFundo: string | null
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * Logo reduzida, ícone e cor de fundo da empresa. Usa select('*') para não falhar enquanto
 * as colunas opcionais (migrations 20261023000053/54/55) ainda não existem no banco.
 * Cacheado por requisição: layout e generateMetadata compartilham a consulta.
 */
export const getCompanyBranding = cache(async (companyId: string | null | undefined): Promise<CompanyBranding> => {
  if (!companyId) return { logoReduzidaUrl: null, iconeUrl: null, corFundo: null }
  const admin = createAdminClient()
  const { data } = await admin.from('companies').select('*').eq('id', companyId).maybeSingle()
  const row = (data ?? {}) as { logo_reduzida_url?: string | null; icone_url?: string | null; cor_fundo?: string | null }
  return {
    logoReduzidaUrl: row.logo_reduzida_url ?? null,
    iconeUrl: row.icone_url ?? null,
    corFundo: row.cor_fundo && HEX_COLOR.test(row.cor_fundo) ? row.cor_fundo : null,
  }
})
