import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBankAccounts, getCreditCards } from './queries'
import { ContasCartoesClient } from './components/contas-cartoes-client'

export const dynamic = 'force-dynamic'

export default async function ContasCartoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [bankAccounts, creditCards] = await Promise.all([
    getBankAccounts(companyId),
    getCreditCards(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <ContasCartoesClient
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        companyId={companyId}
      />
    </div>
  )
}
