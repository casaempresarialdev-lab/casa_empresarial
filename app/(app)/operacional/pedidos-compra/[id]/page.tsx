import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPurchaseOrderById } from '../queries'
import { ViewPedidoCompra } from './view-pedido-compra'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PedidoCompraViewPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const order = await getPurchaseOrderById(id, companyId)
  if (!order) notFound()

  return (
    <div className="max-w-3xl mx-auto">
      <ViewPedidoCompra order={order} />
    </div>
  )
}
