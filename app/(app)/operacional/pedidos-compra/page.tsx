import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPurchaseOrders, getContacts, getActiveProducts } from './queries'
import { PedidosCompraClient } from './components/pedidos-compra-client'

export const dynamic = 'force-dynamic'

export default async function PedidosCompraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/cadastro/passo-2')

  const [orders, contacts, products] = await Promise.all([
    getPurchaseOrders(companyId),
    getContacts(companyId),
    getActiveProducts(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <PedidosCompraClient
        orders={orders}
        contacts={contacts}
        products={products}
        companyId={companyId}
      />
    </div>
  )
}
