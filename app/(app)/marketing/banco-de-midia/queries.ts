import { createAdminClient } from '@/lib/supabase/server'

export type MediaAsset = {
  id: string
  company_id: string
  nome: string | null
  descricao: string | null
  url: string
  thumbnail_url: string | null
  tamanho: number | null
  mime_type: string | null
  duracao_seg: number | null
  area: 'geral' | 'administrativo' | 'financeiro' | 'pessoas' | 'operacional' | 'marketing'
  tema: string | null
  created_at: string
}

export async function getMediaAssets(companyId: string): Promise<MediaAsset[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('media_assets')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MediaAsset[]
}
