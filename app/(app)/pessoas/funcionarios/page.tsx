import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEmployees } from './queries'
import { FuncionariosClient } from './components/funcionarios-client'

export const dynamic = 'force-dynamic'

export default async function FuncionariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/cadastro/passo-2')

  const employees = await getEmployees(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <FuncionariosClient employees={employees} companyId={companyId} />
    </div>
  )
}
