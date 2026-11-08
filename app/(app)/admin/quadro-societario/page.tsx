import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSocios } from './queries'
import { SociosClient } from './components/socios-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function QuadroSocietarioPage() {
  await exigirAcessoPagina('admin.quadro-societario')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const socios = await getSocios(companyId)

  return (
    <div className="w-full">
      <SociosClient socios={socios} companyId={companyId} />
    </div>
  )
}
