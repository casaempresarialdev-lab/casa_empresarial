import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDREData } from './queries'
import { DREClient } from './components/dre-client'

export const dynamic = 'force-dynamic'

export default async function DREPage({
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
  const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]

  const dreData = await getDREData(companyId, startDate, endDate)

  return (
    <div className="max-w-3xl mx-auto">
      <DREClient dreData={dreData} mes={mes} ano={ano} />
    </div>
  )
}
