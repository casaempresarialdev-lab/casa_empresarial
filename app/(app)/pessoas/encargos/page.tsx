import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEncargosEmployees } from './queries'
import { EncargosClient } from './components/encargos-client'

export const dynamic = 'force-dynamic'

export default async function EncargosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const employees = await getEncargosEmployees(companyId)

  return (
    <div className="max-w-6xl mx-auto">
      <EncargosClient employees={employees} />
    </div>
  )
}
