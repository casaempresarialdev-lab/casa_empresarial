import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getCompany } from '../../../empresa/queries'
import { getEmployeeById } from '../../funcionarios/queries'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { getClinicas } from '../../admissao/queries'
import { getAnotacoesRescisao, getConfigRescisao, getExamesRescisao, getRescisao } from '../queries'
import { FichaRescisao } from './components/ficha-rescisao'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

// Ficha da rescisão: aberta ao clicar no card do kanban (ou depois, como consulta)
export default async function FichaRescisaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirAcessoPagina('pessoas.rescisao')

  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const rescisao = await getRescisao(companyId, id)
  if (!rescisao) redirect('/pessoas/rescisao')

  const [config, anotacoes, exames, clinicas, ficha, company, benefits] = await Promise.all([
    getConfigRescisao(companyId),
    getAnotacoesRescisao(companyId, [id]),
    getExamesRescisao(companyId, [id]),
    getClinicas(companyId),
    getEmployeeById(rescisao.employee_id, companyId),
    getCompany(companyId),
    getActiveCompanyBenefits(companyId),
  ])
  if (!ficha) redirect('/pessoas/rescisao')

  let fotoUrl: string | null = null
  if (ficha.foto_path) {
    const { data } = await createAdminClient().storage.from('documentos').createSignedUrl(ficha.foto_path, 3600)
    fotoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="w-full">
      <FichaRescisao
        rescisao={rescisao}
        config={config}
        anotacoes={anotacoes[id]}
        exames={exames[id]}
        clinicas={clinicas}
        ficha={ficha}
        company={company}
        benefits={benefits}
        fotoUrl={fotoUrl}
        companyId={companyId}
      />
    </div>
  )
}
