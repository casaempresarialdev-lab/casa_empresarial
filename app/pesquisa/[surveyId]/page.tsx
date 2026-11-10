import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSurveyByIdPublic } from '@/app/(app)/pessoas/pesquisas/queries'
import { hojeBrasil, motivoFechada } from '@/lib/pesquisa'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
import { SurveyForm } from './components/survey-form'

export const dynamic = 'force-dynamic'

// Página pública da pesquisa: com a marca da empresa; logado, sabe se a pessoa já respondeu
export default async function PesquisaPublicaPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params
  const survey = /^[0-9a-f-]{36}$/i.test(surveyId) ? await getSurveyByIdPublic(surveyId) : null

  const admin = createAdminClient()
  const { data: empresa } = survey
    ? await admin.from('companies').select('nome_fantasia, razao_social, logo_url, cor_primaria').eq('id', survey.company_id).maybeSingle()
    : { data: null }

  let logado = false
  let jaRespondeu = false
  if (survey) {
    try {
      const { data: { user } } = await (await createClient()).auth.getUser()
      logado = !!user
      if (user) {
        const { data } = await admin.from('survey_participations').select('survey_id').eq('survey_id', survey.id).eq('profile_id', user.id).maybeSingle()
        jaRespondeu = !!data
      }
    } catch {
      // Sem sessão: segue como resposta anônima
    }
  }

  return (
    <SurveyForm
      survey={survey}
      motivo={survey ? motivoFechada(survey, hojeBrasil()) : null}
      jaRespondeu={jaRespondeu}
      logado={logado}
      marca={{
        nome: (empresa?.nome_fantasia as string | null) || (empresa?.razao_social as string | null) || null,
        logo: (empresa?.logo_url as string | null) ?? null,
        cor: (empresa?.cor_primaria as string | null) || DEFAULT_BRAND_COLOR,
      }}
    />
  )
}
