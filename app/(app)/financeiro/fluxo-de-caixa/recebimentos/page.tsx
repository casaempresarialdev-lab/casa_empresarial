import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllTransactions } from '../queries'
import { getCategories } from '../../categorias/queries'
import { getContacts } from '../../contatos/queries'
import { getBankAccounts, getCreditCards } from '../../contas-cartoes/queries'
import { getCostCenters } from '../../centro-de-custo/queries'
import { LancamentosClient } from '../components/lancamentos-client'

export const dynamic = 'force-dynamic'

export default async function RecebimentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [transactions, categories, contacts, bankAccounts, creditCards, costCenters] = await Promise.all([
    getAllTransactions(companyId, 'recebimento'),
    getCategories(companyId),
    getContacts(companyId),
    getBankAccounts(companyId),
    getCreditCards(companyId),
    getCostCenters(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <LancamentosClient
        transactions={transactions}
        tipo="recebimento"
        companyId={companyId}
        categories={categories}
        contacts={contacts}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        costCenters={costCenters}
      />
    </div>
  )
}
