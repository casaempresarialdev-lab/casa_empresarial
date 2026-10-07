import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from './queries'
import { EmpresaForm } from './components/empresa-form'

export const dynamic = 'force-dynamic'

export default async function EmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>
}) {
  const { nova } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value

  // ?nova=1 força o formulário de criação (vindo do "+ Nova empresa" do seletor),
  // mesmo que já exista uma empresa ativa.
  const company = (companyId && nova !== '1') ? await getCompany(companyId) : null

  return (
    <EmpresaForm company={company} />
  )
}
