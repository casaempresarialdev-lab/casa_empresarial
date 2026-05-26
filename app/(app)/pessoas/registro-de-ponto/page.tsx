import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTimeRecords, getActiveEmployees } from './queries'
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

  const [records, employees] = await Promise.all([
    getTimeRecords(companyId, ano, mes),
    getActiveEmployees(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <PontoClient
        records={records}
        employees={employees}
        companyId={companyId}
        mes={mes}
        ano={ano}
      />
    </div>
  )
}
