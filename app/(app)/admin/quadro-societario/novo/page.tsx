import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSocios } from '../queries'
import { NovoSocioPage } from './components/novo-socio-page'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function NovoSocioRoute() {
  await exigirAcessoPagina('admin.quadro-societario')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  // Participação já distribuída entre os sócios cadastrados
  const socios = await getSocios(companyId)
  const outrasParticipacoes = socios.reduce((sum, s) => sum + Number(s.participacao ?? 0), 0)

  return (
    <div className="w-full">
      <NovoSocioPage companyId={companyId} outrasParticipacoes={outrasParticipacoes} />
    </div>
  )
}
