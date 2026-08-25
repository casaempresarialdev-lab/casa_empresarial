import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveEmployees } from '../queries'
import { FormNovaRegra } from './components/form-nova-regra'

export const dynamic = 'force-dynamic'

export default async function NovaRegraEscalaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const employees = await getActiveEmployees(companyId)

  return (
    <div className="max-w-2xl mx-auto">
      <FormNovaRegra companyId={companyId} employees={employees} />
    </div>
  )
}
