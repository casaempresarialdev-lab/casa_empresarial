import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCostCenters } from './queries'
import { CentroCustoClient } from './components/centro-custo-client'

export const dynamic = 'force-dynamic'

export default async function CentroCustoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const costCenters = await getCostCenters(companyId)

  return (
    <div className="max-w-3xl mx-auto">
      <CentroCustoClient costCenters={costCenters} companyId={companyId} />
    </div>
  )
}
