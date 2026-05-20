import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServiceProviders } from './queries'
import { PrestadoresClient } from './components/prestadores-client'

export const dynamic = 'force-dynamic'

export default async function PrestadoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/cadastro/passo-2')

  const providers = await getServiceProviders(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <PrestadoresClient providers={providers} companyId={companyId} />
    </div>
  )
}
