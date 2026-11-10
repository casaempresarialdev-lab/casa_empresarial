import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { periodoDoMes } from '@/lib/escala/periodo'
import { getFeriadosEmpresa, getScheduleRules, getScheduleExceptionsEntre, getActiveEmployees } from './queries'
import { getCompany } from '../../empresa/queries'
import { EscalaClient } from './components/escala-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function EscalaDeTrabalhoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  await exigirAcessoPagina('pessoas.escala-de-trabalho')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const params = await searchParams
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') && !Number.isNaN(Date.parse(params.data as string)) ? (params.data as string) : hoje
  const periodo = periodoDoMes(data)

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador && !viewer.myEmployeeId) notFound()

  const [rulesAll, exceptionsAll, employeesAll, feriados, company] = await Promise.all([
    getScheduleRules(companyId),
    getScheduleExceptionsEntre(companyId, periodo.inicio, periodo.fim),
    getActiveEmployees(companyId),
    getFeriadosEmpresa(companyId),
    getCompany(companyId),
  ])

  const myId       = viewer?.myEmployeeId
  const rules      = viewer?.isColaborador ? rulesAll.filter(r => r.employee_id === myId) : rulesAll
  const exceptions = viewer?.isColaborador ? exceptionsAll.filter(e => e.employee_id === myId) : exceptionsAll
  const employees  = viewer?.isColaborador ? employeesAll.filter(e => e.id === myId) : employeesAll

  return (
    <div className="w-full">
      <EscalaClient
        rules={rules}
        exceptions={exceptions}
        employees={employees}
        feriados={feriados}
        company={company}
        companyId={companyId}
        data={data}
        readOnly={viewer?.isColaborador ?? false}
      />
    </div>
  )
}
