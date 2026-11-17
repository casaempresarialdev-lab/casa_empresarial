import { createAdminClient } from '@/lib/supabase/server'

export type ConteudoMarketing = {
  id: string
  company_id: string
  titulo: string
  objetivo: string | null
  data_publicacao: string | null
  status: 'ideia' | 'fazendo' | 'feito' | 'agendado' | 'publicado'
  formato: string | null
  formato_outro: string | null
  fase: 'topo' | 'meio' | 'fundo' | null
  canal: string | null
  canal_outro: string | null
  midia_ids: string[]
  responsavel_id: string | null
  created_at: string
  updated_at: string
}

export async function getConteudosMarketing(companyId: string): Promise<ConteudoMarketing[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('editorial_calendar')
    .select('*')
    .eq('company_id', companyId)
    .order('data_publicacao', { ascending: true })

  if (error) throw error
  return (data ?? []) as ConteudoMarketing[]
}
