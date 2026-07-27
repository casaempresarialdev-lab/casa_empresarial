import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSurveyByIdPublic, getSurveyResponses } from '../../queries'
import { ResultadosClient } from './components/resultados-client'

interface Props {
  params: Promise<{ surveyId: string }>
}

export default async function ResultadosPage({ params }: Props) {
  const { surveyId } = await params

  const [survey, responses] = await Promise.all([
    getSurveyByIdPublic(surveyId),
    getSurveyResponses(surveyId),
  ])

  if (!survey) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href="/pessoas/pesquisas"
            className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-flex items-center gap-1"
          >
            ← Voltar para pesquisas
          </Link>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>
            {survey.titulo}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {responses.length} {responses.length === 1 ? 'resposta' : 'respostas'} coletada{responses.length === 1 ? '' : 's'}
          </p>
        </div>

        {responses.length > 0 && (
          <a
            href={`/api/pesquisas/${surveyId}/export`}
            download
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 flex-shrink-0"
          >
            Exportar CSV
          </a>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">Nenhuma resposta recebida ainda.</p>
        </div>
      ) : (
        <ResultadosClient survey={survey} responses={responses} />
      )}
    </div>
  )
}
