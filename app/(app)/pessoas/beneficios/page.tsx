import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeBenefits } from './queries'
import { BeneficiosClient } from './components/beneficios-client'

export const dynamic = 'force-dynamic'

export default async function BeneficiosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const employees = await getEmployeeBenefits(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <BeneficiosClient employees={employees} />
    </div>
  )
}
