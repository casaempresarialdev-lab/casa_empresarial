import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getCompanyBenefits, getEmployeesWithBenefits } from './queries'
import { BeneficiosClient } from './components/beneficios-client'
import { MeusBeneficios } from './components/meus-beneficios'

export const dynamic = 'force-dynamic'

export default async function BeneficiosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)

  const [benefits, employees] = await Promise.all([
    getCompanyBenefits(companyId),
    getEmployeesWithBenefits(companyId),
  ])

  if (viewer?.isColaborador) {
    const me = employees.find(e => e.id === viewer.myEmployeeId)
    if (!me) notFound()
    return (
      <div className="max-w-5xl mx-auto">
        <MeusBeneficios employee={me} benefits={benefits} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <BeneficiosClient companyId={companyId} benefits={benefits} employees={employees} />
    </div>
  )
}
