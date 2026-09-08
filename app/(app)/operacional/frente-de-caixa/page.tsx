import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCashSession, getProductsForPDV } from './queries'
import { PDVClient } from './components/pdv-client'

export const dynamic = 'force-dynamic'

export default async function FrenteDeCaixaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const cashSession = await getActiveCashSession(companyId, user.id)
  if (!cashSession) redirect('/operacional/frente-de-caixa/login')

  const products = await getProductsForPDV(companyId)

  return (
    <PDVClient
      companyId={companyId}
      cashSession={cashSession}
      products={products}
    />
  )
}
