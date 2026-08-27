import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getScheduleRules, getScheduleExceptions, getActiveEmployees } from './queries'
import { EscalaClient } from './components/escala-client'

export const dynamic = 'force-dynamic'

export default async function EscalaDeTrabalhoPage({
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

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador && !viewer.myEmployeeId) notFound()

  const [rulesAll, exceptionsAll, employeesAll] = await Promise.all([
    getScheduleRules(companyId),
    getScheduleExceptions(companyId, mes, ano),
    getActiveEmployees(companyId),
  ])

  const myId       = viewer?.myEmployeeId
  const rules      = viewer?.isColaborador ? rulesAll.filter(r => r.employee_id === myId) : rulesAll
  const exceptions = viewer?.isColaborador ? exceptionsAll.filter(e => e.employee_id === myId) : exceptionsAll
  const employees  = viewer?.isColaborador ? employeesAll.filter(e => e.id === myId) : employeesAll

  return (
    <div className="max-w-6xl mx-auto">
      <EscalaClient
        rules={rules}
        exceptions={exceptions}
        employees={employees}
        companyId={companyId}
        mes={mes}
        ano={ano}
        readOnly={viewer?.isColaborador ?? false}
      />
    </div>
  )
}
