import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getActiveEmployeesForPayroll, getPayrollEntriesVariable } from './queries'
import { getEncargosAliquotas } from '../encargos/queries'
import { getCompany } from '../../empresa/queries'
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

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador && !viewer.myEmployeeId) notFound()

  const [employeesAll, aliquotas, company, entriesArr] = await Promise.all([
    getActiveEmployeesForPayroll(companyId),
    getEncargosAliquotas(companyId),
    getCompany(companyId),
    getPayrollEntriesVariable(companyId, mesAno),
  ])

  const employees = viewer?.isColaborador ? employeesAll.filter(e => e.id === viewer.myEmployeeId) : employeesAll

  // Convert to plain object map for serialization across server→client boundary
  const entries: Record<string, typeof entriesArr[number]> = {}
  for (const e of entriesArr) {
    if (viewer?.isColaborador && e.employee_id !== viewer.myEmployeeId) continue
    entries[e.employee_id] = e
  }

  return (
    <div className="max-w-6xl mx-auto">
      <FolhaClient
        employees={employees}
        aliquotas={aliquotas}
        mesAno={mesAno}
        company={company}
        companyId={companyId}
        entries={entries}
        readOnly={viewer?.isColaborador ?? false}
      />
    </div>
  )
}
