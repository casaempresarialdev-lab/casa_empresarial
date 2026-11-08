import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getAjustes, getTimeRecords, getActiveEmployees } from './queries'
import { getScheduleRules, getScheduleExceptions } from '../escala-de-trabalho/queries'
import { PontoClient } from './components/ponto-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function RegistroDePontoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; aba?: string }>
}) {
  await exigirAcessoPagina('pessoas.registro-de-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const params = await searchParams
  const [anoAtual, mesAtual] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-')
  const mes = parseInt(params.mes ?? mesAtual)
  const ano = parseInt(params.ano ?? anoAtual)

  // O colaborador acompanha e ajusta o próprio ponto em Meu ponto
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/meu-ponto')

  const [records, employees, rules, exceptions, ajustes] = await Promise.all([
    getTimeRecords(companyId, ano, mes),
    getActiveEmployees(companyId),
    getScheduleRules(companyId),
    getScheduleExceptions(companyId, mes, ano),
    getAjustes(companyId),
  ])

  return (
    <div className="w-full">
      <PontoClient
        records={records}
        employees={employees}
        rules={rules}
        exceptions={exceptions}
        companyId={companyId}
        mes={mes}
        ano={ano}
        ajustes={ajustes}
        abaInicial={params.aba === 'aprovacoes' ? 1 : 0}
      />
    </div>
  )
}
