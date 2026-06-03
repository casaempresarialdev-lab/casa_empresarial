import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSurveys } from './queries'
import { PesquisasClient } from './components/pesquisas-client'

export const dynamic = 'force-dynamic'

export default async function PesquisasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const surveys = await getSurveys(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <PesquisasClient surveys={surveys} companyId={companyId} />
    </div>
  )
}
