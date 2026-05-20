import { createAdminClient } from '@/lib/supabase/server'

export type Participante = {
  nome: string
  email?: string
}

export type Meeting = {
  id: string
  company_id: string
  modulo: 'pessoas' | 'marketing' | 'geral'
  titulo: string
  data: string | null
  duracao_min: number | null
  local: string | null
  participantes: Participante[]
  pauta: string | null
  ata: string | null
  status: 'agendada' | 'realizada' | 'cancelada'
  created_at: string
  updated_at: string
}

export async function getMeetings(companyId: string): Promise<Meeting[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('meetings')
    .select('*')
    .eq('company_id', companyId)
    .eq('modulo', 'pessoas')
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as Meeting[]
}
