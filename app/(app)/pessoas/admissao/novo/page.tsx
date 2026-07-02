import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { FormNovoFuncionario } from './components/form-novo-funcionario'

export const dynamic = 'force-dynamic'

export default async function NovoFuncionarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const companyBenefits = await getActiveCompanyBenefits(companyId)

  return (
    <div className="p-6">
      <FormNovoFuncionario companyId={companyId} companyBenefits={companyBenefits} />
    </div>
  )
}
