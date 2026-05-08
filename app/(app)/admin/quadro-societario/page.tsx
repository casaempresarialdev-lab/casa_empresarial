import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSocios } from './queries'
import { SociosClient } from './components/socios-client'

export const dynamic = 'force-dynamic'

export default async function QuadroSocietarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/cadastro/passo-2')

  const socios = await getSocios(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <SociosClient socios={socios} companyId={companyId} />
    </div>
  )
}
