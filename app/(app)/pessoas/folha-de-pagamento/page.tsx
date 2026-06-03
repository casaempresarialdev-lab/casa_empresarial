import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPayrollEntries, getActiveEmployeesForPayroll } from './queries'
import { FolhaClient } from './components/folha-client'

export const dynamic = 'force-dynamic'

export default async function FolhaPagamentoPage({
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
  const mes = (params.mes ?? String(now.getMonth() + 1)).padStart(2, '0')
  const ano = params.ano ?? String(now.getFullYear())
  const mesAno = `${ano}-${mes}`

  const [entries, employees] = await Promise.all([
    getPayrollEntries(companyId, mesAno),
    getActiveEmployeesForPayroll(companyId),
  ])

  return (
    <div className="max-w-6xl mx-auto">
      <FolhaClient
        entries={entries}
        employees={employees}
        companyId={companyId}
        mesAno={mesAno}
      />
    </div>
  )
}
