import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBankAccounts, getCreditCards } from './queries'
import { ContasCartoesClient } from './components/contas-cartoes-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function ContasCartoesPage() {
  await exigirAcessoPagina('financeiro.contas-cartoes')

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
    <div className="w-full">
      <ContasCartoesClient
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        companyId={companyId}
      />
    </div>
  )
}
