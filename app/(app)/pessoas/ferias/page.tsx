import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getConfigFolha } from '../folha-de-pagamento/queries'
import { getCompany } from '../../empresa/queries'
import { getFeriasEquipe, getPessoasFerias } from './queries'
import { FeriasClient } from './components/ferias-client'

export const dynamic = 'force-dynamic'

export default async function FeriasPage() {
  await exigirAcessoPagina('pessoas.ferias')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  // O colaborador acompanha e pede as próprias férias em Minhas férias
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/minhas-ferias')

  const [pessoas, ferias, config, company] = await Promise.all([getPessoasFerias(companyId), getFeriasEquipe(companyId), getConfigFolha(companyId), getCompany(companyId)])

  return (
    <div className="w-full">
      <FeriasClient companyId={companyId} pessoas={pessoas} ferias={ferias} config={config} company={company} responsavel={config.responsavel_calculo} />
    </div>
  )
}
