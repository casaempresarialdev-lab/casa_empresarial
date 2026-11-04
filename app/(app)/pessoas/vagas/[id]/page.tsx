import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getCandidaturas, getVagaById } from '../queries'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { VagaPage } from './components/vaga-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}

export default async function VagaDetalhePage({ params, searchParams }: Props) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) notFound()

  const vaga = await getVagaById(id, companyId)
  if (!vaga) notFound()

  const [candidaturas, companyBenefits] = await Promise.all([
    getCandidaturas(id, companyId),
    getActiveCompanyBenefits(companyId),
  ])

  return (
    <div className="w-full">
      <VagaPage
        vaga={vaga}
        candidaturas={candidaturas}
        companyId={companyId}
        companyBenefits={companyBenefits}
        abrirDados={aba === 'dados'}
      />
    </div>
  )
}
