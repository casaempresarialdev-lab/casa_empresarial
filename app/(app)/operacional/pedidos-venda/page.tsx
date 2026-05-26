import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSaleOrders, getContacts, getActiveProducts } from './queries'
import { PedidosVendaClient } from './components/pedidos-venda-client'

export const dynamic = 'force-dynamic'

export default async function PedidosVendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [orders, contacts, products] = await Promise.all([
    getSaleOrders(companyId),
    getContacts(companyId),
    getActiveProducts(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <PedidosVendaClient
        orders={orders}
        contacts={contacts}
        products={products}
        companyId={companyId}
      />
    </div>
  )
}
