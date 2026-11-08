import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getAdmissaoEmployees, getCartas, getClinicas, getConfigAdmissao, getEntrevistadores, getExames, getHistoricos, getOnboardingTokens } from '../queries'
import { getCompany } from '../../../empresa/queries'
import { getEmployeeById } from '../../funcionarios/queries'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { FichaAdmissao } from './components/ficha-admissao'
import { getCargosOpcoes } from '../../../empresa/estrutura/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

// Ficha de admissão: aberta ao clicar no card do kanban
export default async function FichaAdmissaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirAcessoPagina('pessoas.admissao')

  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const emp = (await getAdmissaoEmployees(companyId, id))[0]
  // Já finalizada, reprovada ou de outra empresa: não há ficha para abrir
  if (!emp) redirect('/pessoas/admissao')

  const [tokens, entrevistadores, config, company, historicos, cartas, clinicas, exames, fichaCompleta, benefits, cargos] = await Promise.all([
    getOnboardingTokens(companyId, id),
    getEntrevistadores(companyId),
    getConfigAdmissao(companyId),
    getCompany(companyId),
    getHistoricos(companyId, [id]),
    getCartas(companyId, [id]),
    getClinicas(companyId),
    getExames(companyId, [id]),
    getEmployeeById(id, companyId),
    getActiveCompanyBenefits(companyId),
    getCargosOpcoes(companyId),
  ])

  let fotoUrl: string | null = null
  if (emp.foto_path) {
    const { data } = await createAdminClient().storage.from('documentos').createSignedUrl(emp.foto_path, 3600)
    fotoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="w-full">
      <FichaAdmissao
        emp={emp}
        fotoUrl={fotoUrl}
        historico={historicos[id]}
        entrevistadores={entrevistadores}
        usuarioId={user.id}
        token={tokens[0]}
        carta={cartas[id]}
        config={config}
        clinicas={clinicas}
        exames={exames[id]}
        fichaCompleta={fichaCompleta ?? emp}
        company={company}
        benefits={benefits}
        cargos={cargos}
        empresa={company?.nome_fantasia || company?.razao_social || ''}
        companyId={companyId}
      />
    </div>
  )
}
