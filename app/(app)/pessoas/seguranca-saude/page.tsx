import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getHealthSafetyRecords, getEmployeesForSS } from './queries'
import { SegurancaClient } from './components/seguranca-client'

export const dynamic = 'force-dynamic'

export default async function SegurancaSaudePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [records, employees] = await Promise.all([
    getHealthSafetyRecords(companyId),
    getEmployeesForSS(companyId),
  ])

  return (
    <div className="max-w-6xl mx-auto">
      <SegurancaClient records={records} employees={employees} companyId={companyId} />
    </div>
  )
}
