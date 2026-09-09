import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContacts, getActiveProducts } from '../queries'
import { FormNovoPedidoCompra } from './components/form-novo-pedido-compra'

export const dynamic = 'force-dynamic'

export default async function NovoPedidoCompraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [contacts, products] = await Promise.all([
    getContacts(companyId),
    getActiveProducts(companyId),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <FormNovoPedidoCompra
        companyId={companyId}
        contacts={contacts}
        products={products}
      />
    </div>
  )
}
