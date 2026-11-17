import { createAdminClient } from '@/lib/supabase/server'

export type MetricaRedeSocial = {
  id: string
  company_id: string
  rede: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'outro'
  mes: string
  seguidores: number
  alcance: number | null
  engajamento: number | null
  observacao: string | null
  created_at: string
}

export async function getMetricasRedesSociais(companyId: string): Promise<MetricaRedeSocial[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('metricas_redes_sociais')
    .select('*')
    .eq('company_id', companyId)
    .order('mes', { ascending: false })

  if (error) throw error
  return (data ?? []) as MetricaRedeSocial[]
}
