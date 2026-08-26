import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmployeeById } from '../../queries'
import { getActiveCompanyBenefits } from '../../../beneficios/queries'
import { EditFuncionarioPage } from './components/edit-funcionario-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FuncionarioEditPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employee, companyBenefits] = await Promise.all([
    getEmployeeById(id, companyId),
    getActiveCompanyBenefits(companyId),
  ])

  if (!employee) notFound()

  return (
    <div className="max-w-3xl mx-auto">
      <EditFuncionarioPage
        employee={employee}
        companyId={companyId}
        companyBenefits={companyBenefits}
      />
    </div>
  )
}
