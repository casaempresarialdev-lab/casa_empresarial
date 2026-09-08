import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServiceOrders, getContacts } from './queries'
import { OrdensServicoClient } from './components/ordens-servico-client'

export const dynamic = 'force-dynamic'

export default async function OrdensDeServicoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [orders, contacts] = await Promise.all([
    getServiceOrders(companyId),
    getContacts(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <OrdensServicoClient
        orders={orders}
        contacts={contacts}
        companyId={companyId}
      />
    </div>
  )
}
