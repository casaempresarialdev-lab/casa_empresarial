import { getSurveyByIdPublic } from '@/app/(app)/pessoas/pesquisas/queries'
import { SurveyForm } from './components/survey-form'

interface Props {
  params: Promise<{ surveyId: string }>
}

export default async function PesquisaPublicaPage({ params }: Props) {
  const { surveyId } = await params
  const survey = await getSurveyByIdPublic(surveyId)

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F7F8FA' }}>
        <div className="text-center p-8">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope', color: '#111827' }}>
            Pesquisa não encontrada
          </h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            O link pode ter expirado ou ser inválido.
          </p>
        </div>
      </div>
    )
  }

  return <SurveyForm survey={survey} />
}
