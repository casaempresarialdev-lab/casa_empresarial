import { createAdminClient } from '@/lib/supabase/server'

export type SurveyQuestion = {
  id: string
  texto: string
  tipo: 'escala' | 'texto' | 'multipla'
  opcoes?: string[]
}

export type Survey = {
  id: string
  company_id: string
  titulo: string
  descricao: string | null
  perguntas: SurveyQuestion[]
  status: 'rascunho' | 'ativo' | 'encerrado'
  data_inicio: string | null
  data_fim: string | null
  created_at: string
  updated_at: string
}

export async function getSurveys(companyId: string): Promise<Survey[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('surveys')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Survey[]
}
