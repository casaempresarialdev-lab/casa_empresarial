import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getCostCenters } from '../centro-de-custo/queries'
import { getCategories } from '../categorias/queries'
import { getBankAccounts, getCreditCards } from '../contas-cartoes/queries'
import { ConfiguracoesClient } from './components/configuracoes-client'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesFinanceiroPage() {
  await exigirAcessoPagina('financeiro.configuracoes')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [costCenters, categories, bankAccounts, creditCards] = await Promise.all([
    getCostCenters(companyId),
    getCategories(companyId),
    getBankAccounts(companyId),
    getCreditCards(companyId),
  ])

  return (
    <div className="w-full">
      <ConfiguracoesClient
        companyId={companyId}
        costCenters={costCenters}
        categories={categories}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
      />
    </div>
  )
}
