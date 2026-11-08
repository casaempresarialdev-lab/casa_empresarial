import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCardInvoices } from './queries'
import { FaturasClient } from './components/faturas-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function FaturasPage() {
  await exigirAcessoPagina('financeiro.faturas')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const invoices = await getCardInvoices(companyId)

  return (
    <div className="w-full">
      <FaturasClient invoices={invoices} />
    </div>
  )
}
