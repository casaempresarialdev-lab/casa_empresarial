import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { NovaAdmissaoPage } from './components/nova-admissao-page'
import { getVagas } from '../../vagas/queries'
import { getCargosOpcoes } from '../../../empresa/estrutura/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function NovoFuncionarioPage() {
  await exigirAcessoPagina('pessoas.admissao')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  // Colaborador não admite funcionários (a ação no servidor também bloqueia)
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const [companyBenefits, cargos, { vagas }] = await Promise.all([getActiveCompanyBenefits(companyId), getCargosOpcoes(companyId), getVagas(companyId)])

  return (
    <div className="w-full">
      <NovaAdmissaoPage companyId={companyId} companyBenefits={companyBenefits} cargos={cargos} vagas={vagas.filter((v) => v.status !== 'encerrada')} />
    </div>
  )
}
