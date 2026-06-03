import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTransactionsByPeriod } from './queries'
import { getCategories } from '../categorias/queries'
import { getContacts } from '../contatos/queries'
import { getBankAccounts, getCreditCards } from '../contas-cartoes/queries'
import { getCostCenters } from '../centro-de-custo/queries'
import { FluxoClient } from './components/fluxo-client'

export const dynamic = 'force-dynamic'

export default async function FluxoCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const params = await searchParams
  const now = new Date()
  const mes = parseInt(params.mes ?? String(now.getMonth() + 1))
  const ano = parseInt(params.ano ?? String(now.getFullYear()))

  const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
  const endDate = new Date(ano, mes, 0).toISOString().split('T')[0] // último dia do mês

  const [transactions, categories, contacts, bankAccounts, creditCards, costCenters] = await Promise.all([
    getTransactionsByPeriod(companyId, startDate, endDate),
    getCategories(companyId),
    getContacts(companyId),
    getBankAccounts(companyId),
    getCreditCards(companyId),
    getCostCenters(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <FluxoClient
        transactions={transactions}
        companyId={companyId}
        mes={mes}
        ano={ano}
        categories={categories}
        contacts={contacts}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        costCenters={costCenters}
      />
    </div>
  )
}
