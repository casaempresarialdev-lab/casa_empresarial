import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSaleOrderById } from '../queries'
import { ViewPedidoVenda } from './view-pedido-venda'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PedidoVendaViewPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const order = await getSaleOrderById(id, companyId)
  if (!order) notFound()

  return (
    <div className="max-w-3xl mx-auto">
      <ViewPedidoVenda order={order} />
    </div>
  )
}
