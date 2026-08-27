import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getTimeRecords, getActiveEmployees } from './queries'
import { getScheduleRules, getScheduleExceptions } from '../escala-de-trabalho/queries'
import { PontoClient } from './components/ponto-client'

export const dynamic = 'force-dynamic'

export default async function RegistroDePontoPage({
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

  const [recordsAll, employeesAll, rulesAll, exceptionsAll] = await Promise.all([
    getTimeRecords(companyId, ano, mes),
    getActiveEmployees(companyId),
    getScheduleRules(companyId),
    getScheduleExceptions(companyId, mes, ano),
  ])

  // Colaborador só pode ver os próprios dados — filtra no server, nunca manda dado de terceiros ao client
  const myId       = viewer?.myEmployeeId
  const records    = viewer?.isColaborador ? recordsAll.filter(r => r.employee_id === myId) : recordsAll
  const employees  = viewer?.isColaborador ? employeesAll.filter(e => e.id === myId) : employeesAll
  const rules      = viewer?.isColaborador ? rulesAll.filter(r => r.employee_id === myId) : rulesAll
  const exceptions = viewer?.isColaborador ? exceptionsAll.filter(e => e.employee_id === myId) : exceptionsAll

  return (
    <div className="max-w-5xl mx-auto">
      <PontoClient
        records={records}
        employees={employees}
        rules={rules}
        exceptions={exceptions}
        companyId={companyId}
        mes={mes}
        ano={ano}
        readOnly={viewer?.isColaborador ?? false}
      />
    </div>
  )
}
