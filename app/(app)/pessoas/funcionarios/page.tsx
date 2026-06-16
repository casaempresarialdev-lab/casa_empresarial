import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmployees } from './queries'
import { getActiveCompanyBenefits } from '../beneficios/queries'
import { FuncionariosClient } from './components/funcionarios-client'

export const dynamic = 'force-dynamic'

export default async function FuncionariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employees, companyBenefits] = await Promise.all([
    getEmployees(companyId),
    getActiveCompanyBenefits(companyId),
  ])

  return (
    <div className="max-w-7xl mx-auto">
      <FuncionariosClient
        employees={employees}
        companyId={companyId}
        companyBenefits={companyBenefits}
      />
    </div>
  )
}
