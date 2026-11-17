import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getDepoimentos } from './queries'
import { DepoimentosClient } from './components/depoimentos-client'

export const dynamic = 'force-dynamic'

export default async function DepoimentosPage() {
  await exigirAcessoPagina('marketing.depoimentos')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const depoimentos = await getDepoimentos(companyId)

  return (
    <div className="w-full">
      <DepoimentosClient depoimentos={depoimentos} companyId={companyId} />
    </div>
  )
}
