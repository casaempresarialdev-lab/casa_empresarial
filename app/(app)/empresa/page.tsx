import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from './queries'
import { EmpresaForm } from './components/empresa-form'

export const dynamic = 'force-dynamic'

export default async function EmpresaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value

  const company = companyId ? await getCompany(companyId) : null

  return (
    <EmpresaForm company={company} />
  )
}
