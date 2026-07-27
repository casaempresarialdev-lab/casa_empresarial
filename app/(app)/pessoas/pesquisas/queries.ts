import { createAdminClient } from '@/lib/supabase/server'

export type SurveyQuestion = {
  id: string
  texto: string
  tipo: 'escala' | 'texto' | 'multipla' | 'escolha'
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
  response_count?: number
}

export type SurveyResponse = {
  id: string
  survey_id: string
  respostas: Record<string, string | string[] | number>
  submitted_at: string
}

export async function getSurveys(companyId: string): Promise<Survey[]> {
  const admin = createAdminClient()

  const { data: surveys, error } = await admin
    .from('surveys')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!surveys || surveys.length === 0) return []

  const { data: responses } = await admin
    .from('survey_responses')
    .select('survey_id')
    .in('survey_id', surveys.map(s => s.id))

  const countMap = (responses ?? []).reduce((acc, r) => {
    acc[r.survey_id] = (acc[r.survey_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return surveys.map(s => ({
    ...(s as unknown as Survey),
    response_count: countMap[s.id] ?? 0,
  }))
}

// Busca pesquisa por ID sem verificar autenticação — usado na página pública
export async function getSurveyByIdPublic(surveyId: string): Promise<Survey | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('surveys')
    .select('*')
    .eq('id', surveyId)
    .single()

  if (error || !data) return null
  return data as unknown as Survey
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as SurveyResponse[]
}
