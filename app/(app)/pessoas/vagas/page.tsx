import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getVagas } from './queries'
import { VagasClient } from './components/vagas-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function VagasPage() {
  await exigirAcessoPagina('pessoas.vagas')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const { vagas, error } = await getVagas(companyId)

  return (
    <div className="w-full">
      <VagasClient vagas={vagas} companyId={companyId} erro={error} />
    </div>
  )
}
